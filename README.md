# webVGM

Copyright (C) 2015 Juergen Wothke

This is a JavaScript/WebAudio plugin of vgmPlay. This plugin is designed to work with my 
generic WebAudio ScriptProcessor music player (see separate project). 

It allows to play various Arcade and Console game music files (see VGMPlay.txt for more details)  - formats like: Video Game Music Files (*.vgm, *.vgz), Creative Music Files (*.cmf), DosBox RAW OPL Log Files (*.dro) - directly in some WebAudio enabled web browser. The plugin does not support archives but only individual music files. (Respective music files can be found on pages like these: http://vgmrips.net/packs/, http://www.smspower.org/Music/VGMs, etc)

A live demo of this program can be found here: http://www.wothke.ch/webvgm/

The project is based on version vgmPlay0.40.6. It includes most of the original code including the 3rd party dependencies. All the "Web" specific additions (i.e. the whole point of this project) are contained in the "emscripten" subfolder. The main interface between the JavaScript/WebAudio world and the original C code is the adapter.c file. Some patches were necessary within the original codebase (these can be located by looking for EMSCRIPTEN if-defs).


## Credits
Based on original C code of vgmPlay (see http://vgmrips.net/forum/viewtopic.php?t=112).

 
## Howto build

You'll need Emscripten (http://kripken.github.io/emscripten-site/docs/getting_started/downloads.html). The make script 
is designed for use of emscripten version 1.37.29 (unless you want to create WebAssembly output, older versions might 
also still work).

The below instructions assume that the vgmplay-0.40.6 project folder has been moved into the main emscripten 
installation folder (maybe not necessary) and that a command prompt has been opened within the 
project's "emscripten" sub-folder, and that the Emscripten environment vars have been previously 
set (run emsdk_env.bat).

The Web version is then built using the makeEmscripten.bat that can be found in this folder. The 
script will compile directly into the "emscripten/htdocs" example web folder, were it will create 
the backend_vgm.js library. The content of the "htdocs" can be tested by first copying it into some 
document folder of a web server. (Caution: The 'make' script compiles various intermediate result libs that
are stores in the 'built' sub-folder. The script DOES NOT check if these libs are up-to-date, i.e. in order
to get a 'clean build' the content of the 'built' folder should be deleted before running 'makeEmscripten.bat')

Study the example in "htdocs" for how the player is used (Notice: In order to play "YMF278B (OPL4)" files you'll 
need a sample ROM, called yrw801.rom - which you should place in the "htdocs" folder.). This project comes without 
any music files, so you'll have to get your own and place them in the htdocs/music folder (you'll also have to 
configure them in the 'songs' list in index.html).

## Dependencies
The current version requires version 1.02 (older versions will not
support WebAssembly) of my https://github.com/wothke/webaudio-player.


## License

This library is free software; you can redistribute it and/or modify it
under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation; either version 2.1 of the License, or (at
your option) any later version. This library is distributed in the hope
that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License for more details.
 
You should have received a copy of the GNU Lesser General Public

License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA
