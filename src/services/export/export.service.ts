import {interval} from '../../utils/utils.date';

import {Invoice} from '../../store/interfaces/invoice';
import {format} from 'date-fns';

import i18next from 'i18next';

import {SocialSharing } from '@ionic-native/social-sharing';

import {Plugins, FilesystemDirectory, FilesystemEncoding} from '@capacitor/core';
import {StatResult} from '@capacitor/core/dist/esm/core-plugin-definitions';

import {Currency} from '../../definitions/currency';

const {Filesystem} = Plugins;

export class ExportService {

    private static instance: ExportService;

    private exportWorker: Worker = new Worker('./workers/export.js');

    private constructor() {
        // Private constructor, singleton
    }

    static getInstance() {
        if (!ExportService.instance) {
            ExportService.instance = new ExportService();
        }
        return ExportService.instance;
    }

    exportNativeFileSystem(invoice: Invoice, from: Date | undefined, to: Date | undefined, currency: Currency, vat: number | undefined, bill: boolean): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (invoice === undefined || invoice.project_id === undefined) {
                reject('No invoice data.');
                return;
            }

            const invoices: string[] | undefined = interval(from, to);

            if (invoices === undefined) {
                reject('No invoices to export.');
                return;
            }

            try {
                const filename: string = this.filename(invoice, from, to);
                const fileHandle: FileSystemFileHandle = await this.getNewFileHandle(filename);

                if (!fileHandle) {
                    reject('Cannot access filesystem.');
                    return;
                }

                this.exportWorker.onmessage = async ($event: MessageEvent) => {
                    if ($event && $event.data) {
                        this.writeFile(fileHandle, $event.data);
                    }
                };

                await this.postMessage(invoice, invoices, currency, vat, bill);

                resolve();
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }

    exportDownload(invoice: Invoice, from: Date | undefined, to: Date | undefined, currency: Currency, vat: number | undefined, bill: boolean): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (invoice === undefined || invoice.project_id === undefined) {
                reject('No invoice data.');
                return;
            }

            const invoices: string[] | undefined = interval(from, to);

            if (invoices === undefined) {
                reject('No invoices to export.');
                return;
            }

            try {
                const filename: string = this.filename(invoice, from, to);

                this.exportWorker.onmessage = async ($event: MessageEvent) => {
                    if ($event && $event.data) {
                        this.download(filename, $event.data);
                    }
                };

                await this.postMessage(invoice, invoices, currency, vat, bill);

                resolve();
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }

    exportMobileFileSystem(invoice: Invoice, from: Date | undefined, to: Date | undefined, currency: Currency, vat: number | undefined, bill: boolean): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (invoice === undefined || invoice.project_id === undefined) {
                reject('No invoice data.');
                return;
            }

            const invoices: string[] | undefined = interval(from, to);

            if (invoices === undefined) {
                reject('No invoices to export.');
                return;
            }

            try {
                const filename: string = this.filename(invoice, from, to);

                this.exportWorker.onmessage = async ($event: MessageEvent) => {
                    if ($event && $event.data) {
                        await this.makeMobileDir();

                        const content: string = await this.blobToString($event.data);

                        await Filesystem.writeFile({
                            path: `tietracker/${filename}`,
                            data: content,
                            directory: FilesystemDirectory.Documents,
                            encoding: FilesystemEncoding.UTF8
                        });

                        await this.shareMobile(invoice, filename);
                    }
                };

                await this.postMessage(invoice, invoices, currency, vat, bill);

                resolve();
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }

    private blobToString(data: Blob): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const fileReader: FileReader = new FileReader();

            fileReader.onload = () => {
                if (!fileReader.result) {
                    reject('Could not convert blob content.');
                    return;
                }

                resolve(fileReader.result as string);
            };

            fileReader.onerror = (error) => {
                reject(error);
            };

            fileReader.readAsText(data);
        });
    }

    private async getNewFileHandle(filename: string): Promise<FileSystemFileHandle> {
        const opts: ChooseFileSystemEntriesOptions = {
            type: 'saveFile',
            accepts: [{
                description: filename,
                extensions: ['xlsx'],
                mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            }],
        };

        return chooseFileSystemEntries(opts);
    }

    private async writeFile(fileHandle: FileSystemFileHandle, contents: string | BufferSource | Blob) {
        // Create a writer (request permission if necessary).
        const writer = await fileHandle.createWriter();
        // Write the full length of the contents
        await writer.write(0, contents);
        // Close the file and write the contents to disk
        await writer.close();
    }

    // https://stackoverflow.com/a/19328891/5404186
    private download(filename: string, data: string) {
        const a: HTMLAnchorElement = document.createElement('a');
        a.style.display = 'none';
        document.body.appendChild(a);

        const blob: Blob = new Blob([data], {type: 'octet/stream'});
        const url: string = window.URL.createObjectURL(blob);

        a.href = url;
        a.download = filename;

        a.click();

        window.URL.revokeObjectURL(url);

        if (a && a.parentElement) {
            a.parentElement.removeChild(a);
        }
    }

    private filename(invoice: Invoice, from: Date | undefined, to: Date | undefined): string {
        const name: string = invoice.client && invoice.client.name ? invoice.client.name : 'export';
        return `${name}${from ? '-' + format(from, 'yyyy-MM-dd') : ''}${to ? '-' + format(to, 'yyyy-MM-dd') : ''}.xlsx`
    }

    private makeMobileDir(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const exist: boolean = await this.existMobileDir();

                if (exist) {
                    resolve();
                    return;
                }

                await Filesystem.mkdir({
                    path: 'tietracker',
                    directory: FilesystemDirectory.Documents,
                    recursive: false
                });

                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    private existMobileDir(): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            try {
                await Filesystem.stat({
                    path: 'tietracker',
                    directory: FilesystemDirectory.Documents
                });

                resolve(true);
            } catch (e) {
                resolve(false);
            }
        });
    }

    private shareMobile(invoice: Invoice, filename: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const stat: StatResult = await Filesystem.stat({
                    path: `tietracker/${filename}`,
                    directory: FilesystemDirectory.Documents
                });

                if (!stat || !stat.uri) {
                    reject('File not found.');
                    return;
                }

                await SocialSharing.shareWithOptions({
                    subject: this.shareSubject(invoice),
                    files: [stat.uri],
                    chooserTitle: 'Pick an app'
                });

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    private shareSubject(invoice: Invoice): string {
        return `Tie Tracker${invoice.client && invoice.client.name ? ` - ${invoice.client.name}` : ''}`
    }

    private async postMessage(invoice: Invoice, invoices: string[], currency: Currency, vat: number | undefined, bill: boolean) {

        await i18next.loadNamespaces('export');

        this.exportWorker.postMessage({
            msg: 'export',
            invoices: invoices,
            projectId: invoice.project_id,
            client: invoice.client,
            currency: currency,
            vat: vat,
            bill: bill,
            i18n: {
                total: i18next.t('export:total'),
                vat_rate: i18next.t('export:vat_rate'),
                vat: i18next.t('export:vat'),
                total_vat_excluded: i18next.t('export:total_vat_excluded'),
                total_billable_hours: i18next.t('export:total_billable_hours'),
                description: i18next.t('export:description'),
                start_date: i18next.t('export:start_date'),
                start_time: i18next.t('export:start_time'),
                end_date: i18next.t('export:end_date'),
                end_time: i18next.t('export:end_time'),
                duration: i18next.t('export:duration'),
                billable: i18next.t('export:billable')
            }
        });
    }
}
