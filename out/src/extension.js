"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const history_controller_1 = require("./history.controller");
const historyTree_provider_1 = require("./historyTree.provider");
/**
* Activate the extension.
*/
function activate(context) {
    var saving_enabled = false;
    const controller = new history_controller_1.HistoryController();
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.showAll', controller.showAll, controller));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.showCurrent', controller.showCurrent, controller));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.compareToActive', controller.compareToActive, controller));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.compareToCurrent', controller.compareToCurrent, controller));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('local-history.compareToPrevious', controller.compareToPrevious, controller));
    // Tree
    const treeProvider = new historyTree_provider_1.default(controller);
    vscode.window.registerTreeDataProvider('treeLocalHistory', treeProvider);
    vscode.window.registerTreeDataProvider('treeLocalHistoryExplorer', treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.deleteAll', treeProvider.deleteAll, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.refresh', treeProvider.refresh, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.more', treeProvider.more, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.forCurrentFile', treeProvider.forCurrentFile, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.forAll', treeProvider.forAll, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.forSpecificFile', treeProvider.forSpecificFile, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.showEntry', treeProvider.show, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.showSideEntry', treeProvider.showSide, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.deleteEntry', treeProvider.delete, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.compareToCurrentEntry', treeProvider.compareToCurrent, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.selectEntry', treeProvider.select, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.compareEntry', treeProvider.compare, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.restoreEntry', treeProvider.restore, treeProvider);
    vscode.commands.registerCommand('treeLocalHistory.enableSaving', () => {
        vscode.window.setStatusBarMessage('Auto Saving enabled!', 3000);
        saving_enabled = true;
    });
    vscode.commands.registerCommand('treeLocalHistory.disableSaving', () => {
        vscode.window.setStatusBarMessage('Auto Saving disabled!', 3000);
        saving_enabled = false;
    });
    // Create first history before save document
    vscode.workspace.onWillSaveTextDocument(e => e.waitUntil(controller.saveFirstRevision(e.document)));
    // Create history on save document
    vscode.workspace.onDidSaveTextDocument(document => {
        if (saving_enabled) {
            controller.saveRevision(document)
                .then((saveDocument) => {
                // refresh viewer (if any)
                if (saveDocument) {
                    treeProvider.refresh();
                }
            });
        }
    });
    setInterval(() => {
        if (saving_enabled) {
            vscode.workspace.saveAll();
            controller.saveRevision(vscode.window.activeTextEditor.document)
                .then((saveDocument) => {
                // refresh viewer (if any)
                if (saveDocument) {
                    treeProvider.refresh();
                }
            });
        }
    }, 15000);
    vscode.window.onDidChangeActiveTextEditor(e => treeProvider.changeActiveFile());
    vscode.workspace.onDidChangeConfiguration(configChangedEvent => {
        if (configChangedEvent.affectsConfiguration('local-history.treeLocation'))
            treeProvider.initLocation();
        else if (configChangedEvent.affectsConfiguration('local-history')) {
            controller.clearSettings();
            treeProvider.refresh();
        }
    });
}
exports.activate = activate;
// function deactivate() {
// }
//# sourceMappingURL=extension.js.map