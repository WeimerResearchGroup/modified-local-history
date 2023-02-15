import * as vscode from 'vscode';

import fs = require('fs');
import path = require('path');
import Timeout from './timeout';

import glob = require('glob');
import rimraf = require('rimraf');
// import mkdirp = require('mkdirp');
import anymatch = require('anymatch');

// node 8.5 has natively fs.copyFile
// import copyFile = require('fs-copy-file');

import {IHistorySettings, HistorySettings} from './history.settings';

export interface IHistoryFileProperties {
    dir: string;
    name: string;
    ext: string;
    file?: string;
    date?: Date;
    history?: string[];
}

/**
 * Controller for handling history.
 */
export class HistoryController {

    private settings: HistorySettings;
    private saveBatch;

    private pattern = '_'+('[0-9]'.repeat(14));

    constructor() {
        this.settings = new HistorySettings();
        this.saveBatch = new Map();
    }


    public saveRevision(document: vscode.TextDocument): Promise<vscode.TextDocument> {
        return this.internalSave(document);
    }


    public getSettings(file: vscode.Uri): IHistorySettings {
        return this.settings.get(file);
    }

    public clearSettings() {
        this.settings.clear();
    }


    /* private */
    private internalSave(document: vscode.TextDocument, isOriginal?: boolean, timeout?: Timeout): Promise<vscode.TextDocument> {

        const settings = this.getSettings(document.uri);

        if (!this.allowSave(settings, document)) {
            return Promise.resolve(undefined);
        }

        if (!isOriginal && settings.saveDelay) {
            if (!this.saveBatch.get(document.fileName)) {
                this.saveBatch.set(document.fileName, document);
                return this.timeoutPromise(this.internalSaveDocument, settings.saveDelay * 1000, [document, settings]);
            } else return Promise.reject(undefined); // waiting
        }

        return this.internalSaveDocument(document, settings, isOriginal, timeout);
    }

    private timeoutPromise(f, delay, args): Promise<any> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                f.apply(this, args)
                    .then(value => resolve(value))
                    .catch(value => reject(value));
            }, delay);
        });
    }

    private internalSaveDocument(document: vscode.TextDocument, settings: IHistorySettings, isOriginal?: boolean, timeout?: Timeout): Promise<vscode.TextDocument> {

        return new Promise((resolve, reject) => {

            let revisionDir;
            if (!settings.absolute) {
                revisionDir = path.dirname(this.getRelativePath(document.fileName).replace(/\//g, path.sep));
            } else {
                revisionDir = this.normalizePath(path.dirname(document.fileName), false);
            }

            const p = path.parse(document.fileName);
            const revisionPattern = this.joinPath(settings.historyPath, revisionDir, p.name, p.ext);     // toto_[0-9]...

            if (isOriginal) {
                vscode.window.showInformationMessage("101");
                // if already some files exists, don't save an original version (cause: the really original version is lost) !
                // (Often the case...)
                const files = glob.sync(revisionPattern, {cwd: settings.historyPath.replace(/\\/g, '/')});
                if (files && files.length > 0)
                    return resolve(files);

                if (timeout && timeout.isTimedOut()) {
                    vscode.window.showErrorMessage(`Timeout when internalSave: ' ${document.fileName}`);
                    return reject('timedout');
                }
            }
            else if (settings.saveDelay)
                this.saveBatch.delete(document.fileName);

            let now = new Date(),
                nowInfo;
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
            } else
                return reject('Error occured');
        });
    }

    private allowSave(settings: IHistorySettings, document: vscode.TextDocument): boolean {
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

    


    private joinPath(root: string, dir: string, name: string, ext: string, pattern: string = this.pattern): string {
        return path.join(root, dir, name + pattern + ext);
    }


    private getRelativePath(fileName: string) {
        let relative = vscode.workspace.asRelativePath(fileName, false);

        if (fileName !== relative) {
            return relative;
        } else
            return path.basename(fileName);
    }

    private mkDirRecursive(fileName: string): boolean {
        try {
            fs.mkdirSync(path.dirname(fileName), {recursive: true});
            // mkdirp.sync(path.dirname(fileName));
            return true;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error with mkdir: '${err.toString()}' file '${fileName}`);
            return false;
        }
    }

    private copyFile(source: string, target: string, timeout?: Timeout): boolean {
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

    private normalizePath(dir: string, withDrive: boolean) {
        if (process.platform === 'win32') {
            if (!withDrive)
                return dir.replace(':', '');
            else
                return dir.replace('\\', ':\\');
        } else
            return dir;
    }
}

