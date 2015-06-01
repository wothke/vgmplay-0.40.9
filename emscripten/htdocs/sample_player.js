/**
* sample_player.js
* version 1.03 (resampler)
*
* 	Copyright (C) 2015 Juergen Wothke
*
* Terms of Use: This software is licensed under a CC BY-NC-SA 
* (http://creativecommons.org/licenses/by-nc-sa/4.0/).
*/

Module= Emscripten.Module;

var fetchSamples= function(e) { 		
	// it seems that it is necessary to keep this explicit reference to the event-handler
	// in order to pervent the dumbshit Chrome GC from detroying it eventually
	
	var f= window.player['genSamples'].bind(window.player); // need to re-bind the instance.. after all this 
															// joke language has no real concept of OO	
	f(e);
};


SamplePlayer = function(bp, onEnd, onUpdate) {
	this.title;
	this.author;
	this.desc;
	this.player;
	this.program;
	this.tracks;

	this.basePath= bp;
	this.isPaused= false;
	this.initialized= false;
	
	this.onEnd= onEnd;
	this.onUpdate= onUpdate;
	
	this.sourceBuffer;
	this.sourceBufferLen;
	this.inputSampleRate;
	this.resampleBuffer;

	this.numberOfSamplesRendered= 0;
	this.numberOfSamplesToRender= 0;
	this.sourceBufferIdx=0;	
	
	this.binaryFileMap = {};	// cache for loaded "file" binaries
	this.pendingFileMap = {};	

	this.isWaitingForFile= false;
	this.initInProgress=false;

	this.SAMPLES_PER_BUFFER;	// allowed: buffer sizes: 256, 512, 1024, 2048, 4096, 8192, 16384

	try {
		window.AudioContext = window.AudioContext||window.webkitAudioContext;
		this.sampleRate = new AudioContext().sampleRate;

		this.inputSampleRate= 48000;	// FIXME: directly set rate used by WebAudio and avoid resampling..
		this.SAMPLES_PER_BUFFER = 8192;
		
		this.resampleBuffer= new Float32Array(Math.round(this.SAMPLES_PER_BUFFER*this.sampleRate/this.inputSampleRate) * 2);
	} catch(e) {
		alert('Web Audio API is not supported in this browser (get Chrome 18 or Firefox 26)');
	}
	
	window.player= this;
};

SamplePlayer.prototype = {
	createScriptProcessor: function(audioCtx) {
		var scriptNode = audioCtx.createScriptProcessor(this.SAMPLES_PER_BUFFER, 0, 2);
		scriptNode.onaudioprocess = fetchSamples;
	//	scriptNode.onaudioprocess = player.generateSamples.bind(player);	// doesn't work with dumbshit Chrome GC
		return scriptNode;
	},
	playSong: function (filename, data, track, boostVolume) {
		this.isPaused= true;
		if (this.loadData(filename, data) == 0) {
			this.selectTrack(filename, track, boostVolume);
			
			this.onUpdate();
			
			this.isPaused= false;
			return true;
		}
		
		return false;
	},
	playTmpFile: function (file) {
		var filename=file.name;	// format detection may depend on prefixes and postfixes..
		var filenameFull= this.basePath+filename;

		var reader = new FileReader();
		reader.onload = function() {

			// store virtual FS so it can be retrieved from Emscripten
			var d= new Uint8Array(reader.result);	
			try {
				Module.FS_createPath("/", this.basePath, true, true);
			} catch(e) {}
			
			try {
				// for some reason neither FS_deleteFile nor FS_unlink seem to be available in my version
				// an I cannot remove the bloody file if it already exists.. :-(
				var f= Module.FS_createDataFile("/", filenameFull, d, true, true);
				this.binaryFileMap[filenameFull]= f;
			} catch(e) {
			}		
			this.playSong(file.name, reader.result, 0, 0);
		}.bind(this);
		reader.readAsArrayBuffer(file);
	},
	
	preloadFiles: function(files, onCompletionHandler) {
		// avoid the async trial&error loading for those
		// files that we already know we'll be needing
		this.isPaused= true;
		this.preload(files, files.length, onCompletionHandler);
	},
	
	preload: function(files, id, onCompletionHandler) {
		if (id == 0) {
			// we are done preloading
			onCompletionHandler();
		} else {
			id--;
			var funcCompleted= function() {this.preload(files, id, onCompletionHandler);}.bind(this); // trigger next load
			return this.preloadFile(files[id], funcCompleted);	
		}
	},
	preloadFile: function (filename, onLoadedHandler) {
		if (filename in this.binaryFileMap)	{
			// the respective file has already been setup
			if (this.binaryFileMap[filename]) {	
			
				return 0;
			}
			return 1;	// error file does not exist
		}
		// Emscripten will be stuck without this file and we better make 
		// sure to not use it before it has been properly reinitialized
		this.isPaused= true;
		this.isWaitingForFile= true;
		this.initialized= false;
		
		
		// requested data not available.. we better load it for next time
		if (!(filename in this.pendingFileMap)) {		// avoid duplicate loading
		
			this.pendingFileMap[filename] = 1;

			var oReq = new XMLHttpRequest();
			oReq.open("GET", filename, true);
			oReq.responseType = "arraybuffer";

			oReq.onload = function (oEvent) {
				var arrayBuffer = oReq.response;
				if (arrayBuffer) {
					console.log("loaded file: "+filename);

				// setup data in our virtual FS (the next access should then be OK)
					var d= new Uint8Array(arrayBuffer);	

					var sp = filename.split('/');	// avoid folders in our virtual Emscripten fs
					var fn = sp[sp.length-1];					
					
					var f= Module.FS_createDataFile("/", fn, d, true, true);
					this.binaryFileMap[filename]= f;
					
					// now that we have an additional file loaded we can retry the initialization
					this.isWaitingForFile= false;

					onLoadedHandler();
				}
				delete this.pendingFileMap[filename]; 
			}.bind(this);
			oReq.onreadystatuschange = function (oEvent) {
			  if (oReq.readyState==4 && oReq.status==404) {
				this.binaryFileMap[filename]= 0;	// file not found
				this.isWaitingForFile= false;
			  }
			}.bind(this);
			oReq.onerror  = function (oEvent) {
				this.binaryFileMap[filename]= 0;	// marker for non existing file
				this.isWaitingForFile= false;
			}.bind(this);

			oReq.send(null);
		}
		return -1;	
	},	
	
	
	loadData: function(filename, arrayBuffer) {
		if(!this.initialized) {
			this.initialized= true;
		} else {
			Module.ccall('emu_teardown', 'number');	// just in case
		}

		if (arrayBuffer) {
			var byteArray = new Uint8Array(arrayBuffer);

			var sp = filename.split('/');
			var fn = sp[sp.length-1];
			var path= '/'; // make it flat... filename.substring(0, filename.lastIndexOf("/"));	if (path.lenght) path= path+"/";
			
			// create a virtual emscripten FS for all the songs that are touched.. so the compiled code will
			// always find what it is looking for.. some players will look to additional resource files in the same folder..
			
			try {
				Module.FS_createDataFile(path, fn, byteArray, true, true);
			} catch(err) {
				// file may already exist, e.g. drag/dropped again.. just keep entry
			}
		
			// load the song's binary data
			var ret = Module.ccall('emu_init', 'number', 
								['number', 'string', 'string'], 
								[this.sampleRate, path, fn]);
			
			return ret;
		}
	},
	getResampledAudio: function(srcBufI16, len) {	
		var resampleLen= Math.round(len * this.sampleRate / this.inputSampleRate);	// for each of the 2 channels
		var bufSize= resampleLen << 1;
		
		if (bufSize > this.resampleBuffer.length) this.resampleBuffer= new Float32Array(bufSize);
		
		// resample the two interleaved channels
		this.resampleChannel(0, srcBufI16, len, resampleLen);
		this.resampleChannel(1, srcBufI16, len, resampleLen);
		
		return resampleLen;
	},
	resampleChannel: function(channelId, srcBufI16, len, resampleLen) {
		// Bresenham algorithm based resampling
		var x0= 0;
		var y0= 0;
		var x1= resampleLen;
		var y1= len;

		var dx =  Math.abs(x1-x0), sx = x0<x1 ? 1 : -1;
		var dy = -Math.abs(y1-y0), sy = y0<y1 ? 1 : -1;
		var err = dx+dy, e2;

		var i1, i2, v;
		for(;;){
			i1= (x0*2) + channelId;
			i2= srcBufI16 + (y0*2) + channelId;
			v= Module.HEAP16[i2] << 16;
			this.resampleBuffer[i1]= v/0x7fffffff;

			if (x0>=x1 && y0>=y1) break;
			e2 = 2*err;
			if (e2 > dy) { err += dy; x0 += sx; }
			if (e2 < dx) { err += dx; y0 += sy; }
		}
	},
	resetSampleRate: function() {
		if (this.newSampleRate > 0) {
			this.sampleRate= this.newSampleRate;
						
			var s= Math.round(this.SAMPLES_PER_BUFFER *this.sampleRate/this.inputSampleRate) *2;
			
			if (s > this.resampleBuffer.length)
				this.resampleBuffer= new Float32Array(s);
				
			this.numberOfSamplesRendered= 0;
			this.numberOfSamplesToRender= 0;
			this.sourceBufferIdx=0;
			
			this.newSampleRate= -1;
		}
	},
	updateTrackInfos: function(filename) {
		ret = Module.ccall('emu_get_track_info', 'number');
		
		var array = Module.HEAP32.subarray(ret>>2, (ret>>2)+6);
		this.title= Module.Pointer_stringify(array[0]);
		if (!this.title.length) this.title= filename;		
		this.author= Module.Pointer_stringify(array[1]);		
		this.desc= Module.Pointer_stringify(array[2]);
		this.player= Module.Pointer_stringify(array[3]);
		this.program= Module.Pointer_stringify(array[4]);
		this.tracks= Module.Pointer_stringify(array[5]);
				
	},
	selectTrack: function(filename, id, boostVolume) {
	
		ret = Module.ccall('emu_set_subsong', 'number', ['number', 'number'], [id, boostVolume]);
			
		this.updateTrackInfos(filename);	  
	},
	genSamples: function(event) {
		var output1 = event.outputBuffer.getChannelData(0);
		var output2 = event.outputBuffer.getChannelData(1);

		if (this.isPaused) {
			var i;
			for (i= 0; i<output1.length; i++) {
				output1[i]= 0;
				output2[i]= 0;
			}		
		} else {
			var outSize= output1.length;
			
			this.numberOfSamplesRendered = 0;		

			while (this.numberOfSamplesRendered < outSize)
			{
				if (this.numberOfSamplesToRender == 0) {
				
					var status = Module.ccall('emu_compute_audio_samples', 'number');
					if (status != 0) {
						// no frame left
						this.fillEmpty(outSize, output1, output2);	
						if (this.onEnd) this.onEnd();
						this.isPaused= true;
						return;
					}
					// refresh just in case they are not using one fixed buffer..
					this.sourceBuffer= Module.ccall('emu_get_audio_buffer', 'number');
					this.sourceBufferLen= Module.ccall('emu_get_audio_buffer_length', 'number');
					
					var srcBufI16= this.sourceBuffer>>1;	// 2 x 16 bit samples
					this.numberOfSamplesToRender =  this.getResampledAudio(srcBufI16, this.sourceBufferLen);
					this.sourceBufferIdx=0;			
				}
				
				if (this.numberOfSamplesRendered + this.numberOfSamplesToRender > outSize) {
					var availableSpace = outSize-this.numberOfSamplesRendered;
					
					var i;
					for (i= 0; i<availableSpace; i++) {
						output1[i+this.numberOfSamplesRendered]= this.resampleBuffer[this.sourceBufferIdx++];
						output2[i+this.numberOfSamplesRendered]= this.resampleBuffer[this.sourceBufferIdx++];
					}				
					this.numberOfSamplesToRender -= availableSpace;
					this.numberOfSamplesRendered = outSize;
				} else {
					var i;
					for (i= 0; i<this.numberOfSamplesToRender; i++) {
						output1[i+this.numberOfSamplesRendered]= this.resampleBuffer[this.sourceBufferIdx++];
						output2[i+this.numberOfSamplesRendered]= this.resampleBuffer[this.sourceBufferIdx++];
					}						
					this.numberOfSamplesRendered += this.numberOfSamplesToRender;
					this.numberOfSamplesToRender = 0;
				} 
			}  
		}	
	},
	fillEmpty: function(outSize, output1, output2) {
		var availableSpace = outSize-this.numberOfSamplesRendered;
		for (i= 0; i<availableSpace; i++) {
			output1[i+this.numberOfSamplesRendered]= 0;
			output2[i+this.numberOfSamplesRendered]= 0;
		}				
		this.numberOfSamplesToRender = 0;
		this.numberOfSamplesRendered = outSize;			
	}
};