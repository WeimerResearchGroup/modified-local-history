"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryController = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const glob = require("glob");
// import mkdirp = require('mkdirp');
const anymatch = require("anymatch");
// node 8.5 has natively fs.copyFile
// import copyFile = require('fs-copy-file');
const history_settings_1 = require("./history.settings");
/**
 * Controller for handling history.
 */
class HistoryController {
    constructor() {
        this.pattern = '_' + ('[0-9]'.repeat(14));
        this.settings = new history_settings_1.HistorySettings();
        this.saveBatch = new Map();
    }
    saveRevision(document) {
        return this.internalSave(document);
    }
    getSettings(file) {
        return this.settings.get(file);
    }
    clearSettings() {
        this.settings.clear();
    }
    /* private */
    internalSave(document, isOriginal, timeout) {
        const settings = this.getSettings(document.uri);
        if (!this.allowSave(settings, document)) {
            return Promise.resolve(undefined);
        }
        if (!isOriginal && settings.saveDelay) {
            console.log("65\n");
            if (!this.saveBatch.get(document.fileName)) {
                this.saveBatch.set(document.fileName, document);
                return this.timeoutPromise(this.internalSaveDocument, settings.saveDelay * 1000, [document, settings]);
            }
            else
                return Promise.reject(undefined); // waiting
        }
        return this.internalSaveDocument(document, settings, isOriginal, timeout);
    }
    timeoutPromise(f, delay, args) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                f.apply(this, args)
                    .then(value => resolve(value))
                    .catch(value => reject(value));
            }, delay);
        });
    }
    internalSaveDocument(document, settings, isOriginal, timeout) {
        return new Promise((resolve, reject) => {
            let revisionDir;
            if (!settings.absolute) {
                revisionDir = path.dirname(this.getRelativePath(document.fileName).replace(/\//g, path.sep));
            }
            else {
                revisionDir = this.normalizePath(path.dirname(document.fileName), false);
            }
            const p = path.parse(document.fileName);
            const revisionPattern = this.joinPath(settings.historyPath, revisionDir, p.name, p.ext); // toto_[0-9]...
            if (isOriginal) {
                vscode.window.showInformationMessage("101");
                // if already some files exists, don't save an original version (cause: the really original version is lost) !
                // (Often the case...)
                const files = glob.sync(revisionPattern, { cwd: settings.historyPath.replace(/\\/g, '/') });
                if (files && files.length > 0)
                    return resolve(files);
                if (timeout && timeout.isTimedOut()) {
                    vscode.window.showErrorMessage(`Timeout when internalSave: ' ${document.fileName}`);
                    return reject('timedout');
                }
            }
            else if (settings.saveDelay)
                this.saveBatch.delete(document.fileName);
            let now = new Date(), nowInfo;
            if (isOriginal) {
                vscode.window.showInformationMessage("119");
                // find original date (if any)
                const state = fs.statSync(document.fileName);
                if (state)
                    now = state.mtime;
            }
            // remove 1 sec to original version, to avoid same name as currently version
            //now = new Date(now.getTime() - (now.getTimezoneOffset() * 60000) - (isOriginal ? 1000 : 0));
            nowInfo = now.toISOString().substring(0, 19).replace(/[-:T]/g, '');
            const revisionFile = this.joinPath(settings.historyPath, revisionDir, p.name, p.ext, `_${nowInfo}`); // toto_20151213215326.js
            if (this.mkDirRecursive(revisionFile) && this.copyFile(document.fileName, revisionFile, timeout)) {
                return resolve(document);
            }
            else
                return reject('Error occured');
        });
    }
    allowSave(settings, document) {
        if (!settings.enabled) {
            return false;
        }
        if (!(document && /*document.isDirty &&*/ document.fileName)) {
            return false;
        }
        // Use '/' with glob
        const docFile = document.fileName.replace(/\\/g, '/');
        // @ts-ignore
        if (settings.exclude && settings.exclude.length > 0 && anymatch(settings.exclude, docFile))
            return false;
        return true;
    }
    joinPath(root, dir, name, ext, pattern = this.pattern) {
        return path.join(root, dir, name + pattern + ext);
    }
    getRelativePath(fileName) {
        let relative = vscode.workspace.asRelativePath(fileName, false);
        if (fileName !== relative) {
            return relative;
        }
        else
            return path.basename(fileName);
    }
    mkDirRecursive(fileName) {
        try {
            fs.mkdirSync(path.dirname(fileName), { recursive: true });
            // mkdirp.sync(path.dirname(fileName));
            return true;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error with mkdir: '${err.toString()}' file '${fileName}`);
            return false;
        }
    }
    copyFile(source, target, timeout) {
        try {
            let buffer;
            buffer = fs.readFileSync(source);
            if (timeout && timeout.isTimedOut()) {
                vscode.window.showErrorMessage(`Timeout when copyFile: ' ${source} => ${target}`);
                return false;
            }
            fs.writeFileSync(target, buffer);
            return true;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error with copyFile: '${err.toString()} ${source} => ${target}`);
            return false;
        }
    }
    normalizePath(dir, withDrive) {
        if (process.platform === 'win32') {
            if (!withDrive)
                return dir.replace(':', '');
            else
                return dir.replace('\\', ':\\');
        }
        else
            return dir;
    }
}
exports.HistoryController = HistoryController;
//# sourceMappingURL=history.controller.js.map