/*
 vgm_adapter.js: Adapts vgmPlay backend to generic WebAudio/ScriptProcessor player.
 
 version 1.0
 
 	Copyright (C) 2015 Juergen Wothke

 LICENSE
 
 This library is free software; you can redistribute it and/or modify it
 under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 2.1 of the License, or (at
 your option) any later version. This library is distributed in the hope
 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
 warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public
 License along with this library; if not, write to the Free Software
 Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA
*/

VgmBackendAdapter = (function(){ var $this = function (resourcePath) {
		$this.base.call(this, backend_vgmPlay.Module, 2);	
		this.resourcePath= (typeof resourcePath == 'undefined') ? "": resourcePath;
	}; 
	// vglPlay's sample buffer contains 2-byte integer sample data (i.e. must be rescaled) 
	// of 2 interleaved channels
	extend(EmsHEAP16BackendAdapter, $this, {  
		getAudioBuffer: function() {
			var ptr=  this.Module.ccall('emu_get_audio_buffer', 'number');			
			// make it a this.Module.HEAP16 pointer
			return ptr >> 1;	// 2 x 16 bit samples			
		},
		getAudioBufferLength: function() {
			var len= this.Module.ccall('emu_get_audio_buffer_length', 'number');
			return len;
		},
		computeAudioSamples: function() {
			return this.Module.ccall('emu_compute_audio_samples', 'number');
		},
		getMaxPlaybackPosition: function() { 
			return this.Module.ccall('emu_get_max_position', 'number');
		},
		getPlaybackPosition: function() {
			return this.Module.ccall('emu_get_position', 'number');
		},
		seekPlaybackPosition: function(pos) { 
			return this.Module.ccall('emu_seek_position', 'number', ['number'], [pos]);
		},
		mapUrl: function(filename) {
			// PlayMOD hack: only 2 resource files used here
			// note: vgmplay will look for these files without the path prefix, i.e. 
			// registerFileData must be implemented accoredingly
			if ((filename == "VGMPlay.ini") || (filename == "yrw801.rom") ) filename = this.resourcePath+filename;
			return filename;
		},
		getPathAndFilename: function(filename) {
			var sp = filename.split('/');	// avoid folders in our virtual Emscripten fs
			var fn = sp[sp.length-1];					
			var path= '/'; // make it flat... filename.substring(0, filename.lastIndexOf("/"));	if (path.lenght) path= path+"/";
			return [path, fn];
		},
		registerFileData: function(pathFilenameArray, data) {
			return this.registerEmscriptenFileData(pathFilenameArray, data);
		},
		loadMusicData: function(sampleRate, path, filename, data) {
			var ret = this.Module.ccall('emu_init', 'number', 
								['number', 'string', 'string'], 
								[sampleRate, path, filename]);

			if (ret == 0) {			
				var inputSampleRate = this.Module.ccall('emu_get_sample_rate', 'number');
				this.resetSampleRate(sampleRate, inputSampleRate); 
			}
			return ret;
		},
		evalTrackOptions: function(options) {
			if (typeof options.timeout != 'undefined') {
				ScriptNodePlayer.getInstance().setPlaybackTimeout(options.timeout*1000);
			}
			var id= (options && options.track) ? options.track : 0;
			var boostVolume= (options && options.boostVolume) ? options.boostVolume : 0;
		
			return this.Module.ccall('emu_set_subsong', 'number', ['number', 'number'], [id, boostVolume]);			
		},				
		teardown: function() {
			this.Module.ccall('emu_teardown', 'number');	// just in case
		},
		getSongInfoMeta: function() {
			return {title: String, 
					author: String, 
					desc: String, 
					notes: String, 
					program: String,	// deprecated use "system" 
					system: String, 
					chips: String,
					tracks: Number,
					currentTrack: Number
					};					
		},
		unicodeToString: function(ptr) {
			ptr = ptr >> 2;	//32-bit
			var str = '';
			for (var i= 0; i< 255*4; i++) {	// use a limit just in case
				var ch = this.Module.HEAP32[ptr++];
				if (!ch) { 
					return str;
				}
				str += String.fromCharCode(ch);
			}
		},
		
		updateSongInfo: function(filename, result) {
			var numAttr= 6;
			var ret = this.Module.ccall('emu_get_track_info', 'number');

			var array = this.Module.HEAP32.subarray(ret>>2, (ret>>2)+numAttr);
			result.title= this.unicodeToString(array[0]);
			if (!result.title.length) result.title= filename.replace(/^.*[\\\/]/, '').split('.').slice(0, -1).join('.');
			result.author= this.unicodeToString(array[1]);		
			result.desc= this.unicodeToString(array[2]);
			result.notes= this.unicodeToString(array[3]);
			result.system= this.unicodeToString(array[4]);
			result.program= result.system;	// deprecated
			result.chips= this.Module.Pointer_stringify(array[5]);
			var t= this.Module.Pointer_stringify(array[6]);
			result.tracks= parseInt(t);
			result.currentTrack= 0;
		}
	});	return $this; })();