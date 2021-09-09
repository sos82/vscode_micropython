'use babel';

import * as vscode from 'vscode';
import * as path from 'path';
import { throws } from 'assert';

const fs = require('fs').promises;
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline')
var events = require('events');

export class MicrobitFileProvider implements vscode.TreeDataProvider<MicrobitFile> {
	private serialPort;
	private buff = "";
	private files = null;
	private eventHasData = new events.EventEmitter();


	private _onDidChangeTreeData: vscode.EventEmitter<MicrobitFile | undefined | void> = new vscode.EventEmitter<MicrobitFile | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<MicrobitFile | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {
		console.log(workspaceRoot);
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: MicrobitFile): vscode.TreeItem {
		return element;
	}

	getChildren(element?: MicrobitFile): Thenable<MicrobitFile[]> {
		if (typeof this.serialPort === "undefined" || !this.serialPort.isOpen )
		{
			vscode.window.showInformationMessage("Serial isn't connected");
			return Promise.resolve([]);
		}
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}

		return Promise.resolve(this.GetFilesFromMicrobit());
	}

	public async ResetDevice() : Promise<void> {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			cancellable: false,
			title: 'Reset device'
		}, async (progress) => {
			
			progress.report({  increment: 0 });
		
			// Wait for 60 second to clear error
			let data = await this.SendAndRecv("\x04",  60 * 1000);
			vscode.window.showInformationMessage(data);
		
			progress.report({ increment: 100 });
			return data;
		});

	}

	public uploadFiles(): void{
		fs.readdir(this.workspaceRoot, async (error, files) => {
			if (error)
				console.log(error);
			else {
				for (const file of files) {
					console.log("Begin write " + file)
					await this.UploadFile(path.join(this.workspaceRoot, file), file);
					console.log("End write " + file)
				}
				vscode.window.showInformationMessage("All files are uploaded. Reboot device");
				await this.ResetDevice();
				await this.refresh();
			}
		}
		);
		
	}

	public DisconnectDevice(): void {
		this.serialPort.close();
		this.refresh();
	}

	public async downloadFiles(): Promise<void>{
		for (const element of this.files)
		{
			console.log("Begin read " + element.filename)
			await this.DownloadFile(element.filename, path.join(this.workspaceRoot, element.filename))
			console.log("End read " + element.filename)

		}
		vscode.window.showInformationMessage('Downloaded all file ');
	}

	public async deleteFile(node: MicrobitFile):Promise<void>{
		await this.SendAndRecv("import os\r\n");
		await this.SendAndRecv("os.remove('" + node.filename + "')\r\n");
		await this.refresh();
	}


	public Connect() : void {
		SerialPort.list().then(
			ports => {
				ports.forEach(element => {
					
                    if (parseInt(element.productId, 16) == 0x0204 
						&& parseInt(element.vendorId, 16) == 0x0D28)
					{
						this.ConnectToMicrobit(element.path);
						return;
					}
					
				});
			},
			err => {
				// TODO show error
			}
		);
		  
	}

	async DownloadFile(file:string, dest: string) :Promise<void>{
		let result = await this.SendAndRecv("f = open('" + file +"', 'r')\r\n");
		console.log(result);
		
		let content = await this.SendAndRecv("print(f.read())\r\n");
		
		result = await this.SendAndRecv("f.close()\r\n");
		console.log(result);

		await fs.writeFile(dest, content);
	}

	async UploadFile(file:string, target:string) :Promise<void>{
		let data = await fs.readFile(file, "binary");
		
		data = data.replace(/\r/g, "");
		data = data.replace(/\n/g, "\\x0A");
		let result = await this.SendAndRecv("f = open('" + target +"', 'w')\r\n");
		console.log(result);
		result = await this.SendAndRecv("f.write(b'" +data+"')\r\n");
		console.log(result);
		result = await this.SendAndRecv("f.close()\r\n");

	}

	async GetFilesFromMicrobit() : Promise< MicrobitFile[]>{
		let data = await this.SendAndRecv("import os\r\n");
		data = eval(await this.SendAndRecv("os.listdir()\r\n"));
		console.log(data)

		this.files = []
		for (const idx in data)
		{
			this.files = this.files.concat(new MicrobitFile(data[idx], vscode.TreeItemCollapsibleState.None));
		}

        return this.files
	}

	private async SendAndRecv(cmd: string, timeout : number = 1000): Promise<any> {
		this.serialPort.write(cmd);

		let data = await this.WaitForReady(timeout);
		if (data != null)
			return data.substring(cmd.length);
		else 
			return null;
	}

	private async WaitForReady(timeout : number = 1000 ) : Promise<any> {
		return new Promise((resolve) => {
			let wait = setTimeout(() => {
				console.log("Timeout")
				this.eventHasData.removeAllListeners('data');
				clearTimeout(wait);
				resolve(null);
			}, timeout);

			this.eventHasData.on("data", function(this:any){
				if (this.buff.search(">>>") > -1)
				{
					clearTimeout(wait);
					this.eventHasData.removeAllListeners('data');
					let data = this.buff.substring(0, this.buff.search("\r\n>>>"));
					this.buff = "";
					resolve(data);
				}
			}.bind(this));
		});
	
	}

	private OnRecvData() :void {
		this.buff += this.serialPort.read();
		this.eventHasData.emit("data")
	}

	private async ConnectToMicrobit(serialpath:string):Promise<void>{

		if (this.serialPort && this.serialPort.isOpen )
		{
			vscode.window.showInformationMessage('Still in process ');
			return;
		}
		vscode.window.showInformationMessage('Connecting to ' + serialpath);
		this.serialPort = new SerialPort(serialpath, {
			baudRate: 115200
		});

		this.serialPort.on('readable', this.OnRecvData.bind(this));		
		this.serialPort.on('close', function() { 
			this.DisconnectDevice();
		}.bind(this));

		await this.ResetDevice();
		vscode.window.showInformationMessage('Connected to ' + serialpath);
		this.refresh();

	}
	

}

export class MicrobitFile extends vscode.TreeItem {

	constructor(
		public readonly filename: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(filename, collapsibleState);


	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'document.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'document.svg')
	};

	contextValue = 'MicrobitFile';

}