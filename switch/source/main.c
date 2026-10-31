// Dino Explorateur pour Nintendo Switch : homebrew .nro pour Atmosphère.
//
// Le jeu est une page web. Au lancement, on copie la page (rangée dans la RomFS du .nro)
// sur la carte SD, dans le dossier où Atmosphère sert les pages « HtmlDocument » des homebrews,
// puis on l'ouvre dans le moteur web hors ligne de la console.
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

int main(int argc, char **argv) {
    char msg[256];

    if (appletGetAppletType() != AppletType_Application) {
        showError("Le jeu doit etre lance en mode application :\n"
                  "  garde R appuye en lancant un jeu, puis choisis\n"
                  "  Dino Explorateur dans le menu homebrew.\n"
                  "  (Depuis l'album, le moteur web ne s'ouvre pas.)");
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

    WebCommonConfig config;
    WebCommonReply reply;
    Result rc = webOfflineCreate(&config, WebDocumentKind_OfflineHtmlPage, 0, START_DOC);
    if (R_SUCCEEDED(rc)) {
        // Réglages de confort : on ignore leur résultat, certains n'existent pas sur toutes les versions.
        webConfigSetTouchEnabledOnContents(&config, true);
        webConfigSetScreenShot(&config, true);
        webConfigSetBootDisplayKind(&config, WebBootDisplayKind_Black);
        rc = webConfigShow(&config, &reply);
    }
    if (R_FAILED(rc)) {
        snprintf(msg, sizeof(msg), "Le moteur web n'a pas demarre (code 0x%X).\n"
                 "  Il faut Atmosphere 0.8.5 ou plus recent.", rc);
        showError(msg);
    }
    return 0;
}
