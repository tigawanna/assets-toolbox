export namespace main {

	export class SystemInfo {
	    appName: string;
	    version: string;
	    os: string;
	    arch: string;
	    goVersion: string;
	    desktop: boolean;

	    static createFrom(source: any = {}) {
	        return new SystemInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.version = source["version"];
	        this.os = source["os"];
	        this.arch = source["arch"];
	        this.goVersion = source["goVersion"];
	        this.desktop = source["desktop"];
	    }
	}
	export class WorkspaceViewport {
	    zoom: number;
	    tx: number;
	    ty: number;

	    static createFrom(source: any = {}) {
	        return new WorkspaceViewport(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.zoom = source["zoom"];
	        this.tx = source["tx"];
	        this.ty = source["ty"];
	    }
	}
	export class WorkspaceDocument {
	    id: string;
	    name: string;
	    svg: string;
	    viewport: WorkspaceViewport;
	    updatedAt: string;

	    static createFrom(source: any = {}) {
	        return new WorkspaceDocument(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.svg = source["svg"];
	        this.viewport = this.convertValues(source["viewport"], WorkspaceViewport);
	        this.updatedAt = source["updatedAt"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
}
