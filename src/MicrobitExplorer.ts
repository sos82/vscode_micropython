'use babel';

import * as vscode from 'vscode';
import * as path from 'path';
import { throws } from 'assert';

const fs = require('fs').promises;
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline')
var events = require('events');

export class MicrobitFileProvider implements vscode.TreeDataProvider<PythonFile> {
	private serialPort;
	private buff = "";
	private eventHasData = new events.EventEmitter();


	private _onDidChangeTreeData: vscode.EventEmitter<PythonFile | undefined | void> = new vscode.EventEmitter<PythonFile | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<PythonFile | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {
		console.log(workspaceRoot);
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PythonFile): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PythonFile): Thenable<PythonFile[]> {
		if (typeof this.serialPort === "undefined")
		{
			vscode.window.showInformationMessage("Serial isn't connected");
			return Promise.resolve([]);
		}
		/*
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}
		*/

		return Promise.resolve(this.GetFilesFromMicrobit());

		/*

		if (element) {
			return Promise.resolve(this.getDepsInPackageJson(path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')));
		} else {
			const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
			if (this.pathExists(packageJsonPath)) {
				return Promise.resolve(this.getDepsInPackageJson(packageJsonPath));
			} else {
				vscode.window.showInformationMessage('Workspace has no package.json');
				return Promise.resolve([]);
			}
		}
		*/

	}


	public  uploadFiles(): void{
		
		fs.readdir(this.workspaceRoot, async (error, files) => {
			if (error)
				console.log(error);
			else {
				for (const file of files) {
					console.log("Begih write " + file)
					await this.UploadFile(this.workspaceRoot + "/"+ file, file);
					console.log("End write " + file)
				}
			}
		});
	}


	public Connect() : void {
		vscode.window.showInformationMessage(`Successfully called add entry.`);
		
		SerialPort.list().then(
			ports => {
				ports.forEach(element => {
                    if (element.productId == '0204' && element.vendorId == '0D28')
					//if (element.manufacturer == "ARM" && element.pnpId.search("micro:bit") > -1)
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

	async  UploadFile(file:string, target:string) :Promise<void>{
		/*
		fs.readFile(file, 'utf8', async function(err, data){
			data = data.replace("\r\n", "\\x0D\\x0A");
			let result = await this.SendAndRecv("f = open('" + target +"', 'w')\r\n");
			console.log(result);
			result = await this.SendAndRecv("f.write(b'" +data+"')\r\n");
			console.log(result);
			result = await this.SendAndRecv("f.close()\r\n");
			console.log(result);			// Display the file content
		}.bind(this));
		*/

		let data = await fs.readFile(file, "binary");
		
		data = data.replace("\r\n", "\\x0D\\x0A");
		let result = await this.SendAndRecv("f = open('" + target +"', 'w')\r\n");
		console.log(result);
		result = await this.SendAndRecv("f.write(b'" +data+"')\r\n");
		console.log(result);
		result = await this.SendAndRecv("f.close()\r\n");
		console.log(result);			// Display the file content


	}

	async GetFilesFromMicrobit() : Promise< PythonFile[]>{
		let data = await this.SendAndRecv("import os\r\n");
		data = await this.SendAndRecv("os.listdir()\r\n");
		console.log(data)

        return [new PythonFile("main.py", vscode.TreeItemCollapsibleState.None)]

	}

	private async SendAndRecv(cmd: string): Promise<any> {
		this.serialPort.write(cmd);

		let data = await this.WaitForReady();

		//return data.substring(cmd.length);
		return data;
	}

	private async WaitForReady() : Promise<any> {
		return new Promise((resolve) => {
			let wait = setTimeout(() => {
				console.log("Timeout")
				this.eventHasData.removeAllListeners('data');
				clearTimeout(wait);
				resolve(null);
			}, 1000);

			this.eventHasData.on("data", function(this:any){
				if (this.buff.search(">>>") > -1)
				{
					clearTimeout(wait);
					this.eventHasData.removeAllListeners('data');
					let data = this.buff.substring(0, this.buff.search(">>>"));
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
		this.serialPort = new SerialPort(serialpath, {
			baudRate: 115200
		});

		this.serialPort.on('readable', this.OnRecvData.bind(this));		
		
		let data = await this.WaitForReady();
		if (data == null)
		{
			console.log("Retry send help()")
			data = await this.SendAndRecv("help()\r\n")
		}
		console.log(data)
		
		console.log("Connected")

		this.refresh();
	}
	

}

export class PythonFile extends vscode.TreeItem {

	constructor(
		public readonly filename: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(filename, collapsibleState);

		//this.tooltip = `${this.label}-${this.version}`;
		//this.description = this.version;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	//contextValue = 'dependency';
}