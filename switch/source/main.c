// Dino Explorateur pour Nintendo Switch : homebrew .nro pour Atmosphère.
//
// Le jeu est une page web. Au lancement, on copie la page (rangée dans la RomFS du .nro)
// sur la carte SD, dans le dossier où Atmosphère sert les pages « HtmlDocument » des homebrews,
// puis on l'ouvre dans le moteur web hors ligne de la console (WebSession).
//
// La page n'a pas le droit d'utiliser localStorage dans ce moteur : elle confie sa sauvegarde
// au programme par window.nx, et le programme l'écrit sur la carte SD (SAVE_FILE).
// Messages texte, découpés en morceaux (un message fait au plus 0x7FF0 octets) :
//   page -> programme : "save-begin", "save-part:<texte>"..., "save-end"   enregistrer
//                       "load"                                            relire
//   programme -> page : "saved" ou "save-error"
//                       "load-part:<texte>"..., "load-end"                (rien si pas de sauvegarde)
//                       "ping", plusieurs fois par seconde : le moteur ne remet pas toujours
//                       à la page un message resté seul, le suivant le pousse.
//
// Il faut lancer le menu homebrew en mode application (garder R appuyé en lançant un jeu) :
// depuis l'album, le moteur web ne s'ouvre pas.

#include <stdio.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <switch.h>

#define SRC_DIR "romfs:/webapp"
#define DST_DIR "sdmc:/atmosphere/hbl_html/html-document/dino.htdocs"
// Première page ouverte : la page de test, qui mène au jeu.
#define START_DOC "dino.htdocs/test.html"
#define SAVE_DIR "sdmc:/switch/DinoExplorateur"
#define SAVE_FILE SAVE_DIR "/sauvegarde.txt"
#define SAVE_TMP SAVE_DIR "/sauvegarde.tmp"

#define MSG_MAX 0x7FF0
#define SAVE_MAX (1024 * 1024)
#define PART_BYTES 8000

static char msgBuf[MSG_MAX + 1];
static char saveBuf[SAVE_MAX + 1];
static size_t saveLen = 0;
static char outBuf[PART_BYTES + 32];

// Crée le dossier et tous ses parents (« sdmc:/a/b/c »).
static void makeDirs(const char *path) {
    char tmp[0x300];
    snprintf(tmp, sizeof(tmp), "%s", path);
    for (char *p = tmp + strlen("sdmc:/"); *p; p++) {
        if (*p == '/') { *p = 0; mkdir(tmp, 0777); *p = '/'; }
    }
    mkdir(tmp, 0777);
}

static int isDir(const char *path) {
    struct stat st;
    return stat(path, &st) == 0 && S_ISDIR(st.st_mode);
}

static int copyFile(const char *from, const char *to) {
    static char buf[64 * 1024];
    FILE *in = fopen(from, "rb");
    if (!in) return -1;
    FILE *out = fopen(to, "wb");
    if (!out) { fclose(in); return -1; }
    size_t n;
    int ok = 0;
    while ((n = fread(buf, 1, sizeof(buf), in)) > 0) {
        if (fwrite(buf, 1, n, out) != n) { ok = -1; break; }
    }
    fclose(in);
    fclose(out);
    return ok;
}

// Copie un dossier et son contenu. Renvoie le nombre de fichiers copiés, ou -1.
static int copyDir(const char *from, const char *to) {
    DIR *d = opendir(from);
    if (!d) return -1;
    makeDirs(to);
    int count = 0;
    struct dirent *e;
    char a[0x300], b[0x300];
    while ((e = readdir(d)) != NULL) {
        if (!strcmp(e->d_name, ".") || !strcmp(e->d_name, "..")) continue;
        snprintf(a, sizeof(a), "%s/%s", from, e->d_name);
        snprintf(b, sizeof(b), "%s/%s", to, e->d_name);
        int n = isDir(a) ? copyDir(a, b) : (copyFile(a, b) == 0 ? 1 : -1);
        if (n < 0) { closedir(d); return -1; }
        count += n;
    }
    closedir(d);
    return count;
}

// Affiche un message (sans accents : la police de la console n'en a pas) et attend le bouton +.
static void showError(const char *msg) {
    consoleInit(NULL);
    padConfigureInput(1, HidNpadStyleSet_NpadStandard);
    PadState pad;
    padInitializeDefault(&pad);
    printf("\n  Dino Explorateur\n\n  %s\n\n  Appuie sur + pour quitter.\n", msg);
    while (appletMainLoop()) {
        padUpdate(&pad);
        if (padGetButtonsDown(&pad) & HidNpadButton_Plus) break;
        consoleUpdate(NULL);
    }
    consoleExit(NULL);
}

// Envoie un message à la page (le zéro final compris), en réessayant si la file est pleine.
static void sendText(WebSession *s, const char *text) {
    for (int i = 0; i < 200; i++) {
        bool sent = false;
        if (R_FAILED(webSessionTrySendContentMessage(s, text, (u32)strlen(text) + 1, &sent))) return;
        if (sent) return;
        svcSleepThread(10000000ULL);
    }
}

static int startsWith(const char *s, const char *p) { return strncmp(s, p, strlen(p)) == 0; }

static void writeSave(WebSession *s) {
    makeDirs(SAVE_DIR);
    FILE *f = fopen(SAVE_TMP, "wb");
    int ok = f && fwrite(saveBuf, 1, saveLen, f) == saveLen;
    if (f) fclose(f);
    if (ok) { remove(SAVE_FILE); ok = rename(SAVE_TMP, SAVE_FILE) == 0; }
    sendText(s, ok ? "saved" : "save-error");
}

// Relit la sauvegarde et l'envoie en morceaux, sans couper un caractère UTF-8 en deux.
static void sendSave(WebSession *s) {
    static char data[SAVE_MAX + 1];
    size_t len = 0;
    FILE *f = fopen(SAVE_FILE, "rb");
    if (f) { len = fread(data, 1, SAVE_MAX, f); fclose(f); }
    size_t pos = 0;
    while (pos < len) {
        size_t n = len - pos > PART_BYTES ? PART_BYTES : len - pos;
        while (pos + n < len && n > 0 && ((unsigned char)data[pos + n] & 0xC0) == 0x80) n--;
        memcpy(outBuf, "load-part:", 10);
        memcpy(outBuf + 10, data + pos, n);
        outBuf[10 + n] = 0;
        sendText(s, outBuf);
        pos += n;
    }
    sendText(s, "load-end");
}

static void handleMessage(WebSession *s, const char *m) {
    if (!strcmp(m, "save-begin")) saveLen = 0;
    else if (startsWith(m, "save-part:")) {
        size_t n = strlen(m + 10);
        if (saveLen + n <= SAVE_MAX) { memcpy(saveBuf + saveLen, m + 10, n); saveLen += n; }
    }
    else if (!strcmp(m, "save-end")) writeSave(s);
    else if (!strcmp(m, "load")) sendSave(s);
}

static Result runWeb(void) {
    WebCommonConfig config;
    Result rc = webOfflineCreate(&config, WebDocumentKind_OfflineHtmlPage, 0, START_DOC);
    if (R_FAILED(rc)) return rc;
    // Réglages de confort : on ignore leur résultat, certains n'existent pas sur toutes les versions.
    webConfigSetTouchEnabledOnContents(&config, true);
    webConfigSetScreenShot(&config, true);
    webConfigSetBootDisplayKind(&config, WebBootDisplayKind_Black);
    rc = webConfigSetJsExtension(&config, true);
    if (R_FAILED(rc)) return rc;

    WebSession session;
    webSessionCreate(&session, &config);
    Event *exitEvent = NULL;
    rc = webSessionStart(&session, &exitEvent);
    if (R_FAILED(rc)) { webSessionClose(&session); return rc; }

    int tick = 0;
    while (R_FAILED(eventWait(exitEvent, 0))) {
        if (!appletMainLoop()) { webSessionRequestExit(&session); break; }
        bool got;
        do {
            got = false;
            u64 size = 0;
            if (R_FAILED(webSessionTryReceiveContentMessage(&session, msgBuf, MSG_MAX, &size, &got))) break;
            if (got && size > 0 && size <= MSG_MAX) { msgBuf[size] = 0; handleMessage(&session, msgBuf); }
        } while (got);
        if (++tick % 6 == 0) sendText(&session, "ping");
        svcSleepThread(16000000ULL);
    }
    WebCommonReply reply;
    webSessionWaitForExit(&session, &reply);
    webSessionClose(&session);
    return 0;
}

int main(int argc, char **argv) {
    char msg[256];

    if (appletGetAppletType() != AppletType_Application) {
        showError("Le jeu doit etre lance en mode application :\n"
                  "  garde R appuye en lancant un jeu, puis choisis\n"
                  "  Dino Explorateur dans le menu homebrew.\n"
                  "  (Depuis l'album, le moteur web ne s'ouvre pas.)");
        return 0;
    }
    if (hosversionBefore(7, 0, 0)) {
        showError("Il faut le systeme 7.0.0 ou plus recent.");
        return 0;
    }

    if (R_FAILED(romfsInit())) {
        showError("Impossible de lire les fichiers du jeu (RomFS).");
        return 0;
    }
    int copied = copyDir(SRC_DIR, DST_DIR);
    romfsExit();
    if (copied <= 0) {
        showError("Impossible de copier le jeu sur la carte SD\n"
                  "  (dossier atmosphere/hbl_html/html-document).");
        return 0;
    }

    Result rc = runWeb();
    if (R_FAILED(rc)) {
        snprintf(msg, sizeof(msg), "Le moteur web n'a pas demarre (code 0x%X).\n"
                 "  Il faut Atmosphere 0.8.5 ou plus recent.", rc);
        showError(msg);
    }
    return 0;
}
