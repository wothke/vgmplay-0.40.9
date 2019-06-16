rem  POOR MAN'S DOS PROMPT BUILD SCRIPT.. make sure to delete the respective *.bc files before building 
rem  existing *.bc files will not be recompiled. Unfortunately the script occasionally 
rem  fails for no good reason - this must be the wonderful world of DOS/Win... ;-)

rem NOTE: VGM_BIG_ENDIAN is NOT the opposite of VGM_LITTLE_ENDIAN! and neither one must be set in order for it to work here
setlocal enabledelayedexpansion

SET ERRORLEVEL
VERIFY > NUL
set "OPT= -s ERROR_ON_UNDEFINED_SYMBOLS=0 -s FORCE_FILESYSTEM=1 -s WASM=0 -s VERBOSE=0 -s ASSERTIONS=0 -Wcast-align -fno-strict-aliasing -s VERBOSE=0 -s SAFE_HEAP=0 -s NO_EXIT_RUNTIME=1 -s DISABLE_EXCEPTION_CATCHING=1 -DENABLE_ALL_CORES -DFM_EMU -DADDITIONAL_FORMATS -DSET_CONSOLE_TITLE -DDISABLE_HW_SUPPORT -DNO_DEBUG_LOGS  -Wno-pointer-sign -I. -I.. -I../3rdParty/zlib/ -I../src/ --memory-init-file 0 -Os  -O3 "

if not exist "built/thirdparty.bc" (
	call emcc.bat %OPT%  ../3rdParty/zlib/adler32.c ../3rdParty/zlib/compress.c ../3rdParty/zlib/crc32.c ../3rdParty/zlib/gzio.c ../3rdParty/zlib/uncompr.c ../3rdParty/zlib/deflate.c ../3rdParty/zlib/trees.c ../3rdParty/zlib/zutil.c ../3rdParty/zlib/inflate.c ../3rdParty/zlib/infback.c ../3rdParty/zlib/inftrees.c ../3rdParty/zlib/inffast.c -o built/thirdparty.bc
	IF !ERRORLEVEL! NEQ 0 goto :END
)

if not exist "built/chips.bc" (
	call emcc.bat %OPT% ../src/chips/x1_010.c ../src/chips/ws_audio.c ../src/chips/vsu.c ../src/chips/saa1099.c ../src/chips/iremga20.c ../src/chips/es5506.c ../src/chips/es5503.c ../src/chips/c352.c ../src/chips/262intf.c ../src/chips/2151intf.c ../src/chips/2203intf.c ../src/chips/2413intf.c ../src/chips/2608intf.c ../src/chips/2610intf.c ../src/chips/2612intf.c ../src/chips/3526intf.c ../src/chips/3812intf.c ../src/chips/8950intf.c ../src/chips/adlibemu_opl2.c ../src/chips/adlibemu_opl3.c ../src/chips/ay8910.c ../src/chips/ay_intf.c ../src/chips/c140.c ../src/chips/c6280.c ../src/chips/c6280intf.c ../src/chips/dac_control.c ../src/chips/emu2149.c ../src/chips/emu2413.c ../src/chips/es5506.c ../src/chips/fm2612.c ../src/chips/fm.c ../src/chips/fmopl.c ../src/chips/gb.c ../src/chips/k051649.c ../src/chips/k053260.c ../src/chips/k054539.c ../src/chips/multipcm.c ../src/chips/nes_apu.c ../src/chips/nes_intf.c ../src/chips/np_nes_apu.c ../src/chips/np_nes_dmc.c ../src/chips/np_nes_fds.c ../src/chips/okim6258.c ../src/chips/okim6295.c ../src/chips/Ootake_PSG.c ../src/chips/panning.c ../src/chips/pokey.c ../src/chips/pwm.c ../src/chips/qsound_mame.c ../src/chips/qsound_intf.c ../src/chips/qsound_ctr.c ../src/chips/rf5c68.c ../src/chips/segapcm.c ../src/chips/scd_pcm.c ../src/chips/scsp.c ../src/chips/scspdsp.c ../src/chips/sn76489.c ../src/chips/sn76496.c ../src/chips/sn764intf.c ../src/chips/upd7759.c ../src/chips/ym2151.c ../src/chips/ym2413.c ../src/chips/ym2612.c ../src/chips/ymdeltat.c ../src/chips/ymf262.c ../src/chips/ymf271.c ../src/chips/ymf278b.c ../src/chips/ymz280b.c ../src/chips/ay8910_opl.c ../src/chips/sn76496_opl.c ../src/chips/ym3438.c  ../src/chips/ym2413hd.c ../src/chips/ym2413_opl.c  -o built/chips.bc
	IF !ERRORLEVEL! NEQ 0 goto :END
)

if not exist "built/main.bc" (
	call emcc.bat %OPT% ../src/ChipMapper.c ../src/VGMPlay.c ../src/VGMPlayUI.c ../src/VGMPlay_AddFmts.c -o built/main.bc
	IF !ERRORLEVEL! NEQ 0 goto :END
)
call emcc.bat %OPT% -s TOTAL_MEMORY=67108864  --closure 1 --llvm-lto 1 adapter.c   built/thirdparty.bc built/chips.bc built/main.bc   -s EXPORTED_FUNCTIONS="['_emu_init','_emu_get_sample_rate','_emu_get_position','_emu_get_max_position','_emu_seek_position','_emu_teardown','_emu_set_subsong','_emu_get_track_info','_emu_get_audio_buffer','_emu_get_audio_buffer_length','_emu_compute_audio_samples', '_malloc', '_free']"  -o htdocs/vgm.js  -s SINGLE_FILE=0 -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall', 'Pointer_stringify']"  -s BINARYEN_ASYNC_COMPILATION=1 -s BINARYEN_TRAP_MODE='clamp' && copy /b shell-pre.js + htdocs\vgm.js + shell-post.js htdocs\vgmPlay3.js && del htdocs\vgm.js  && copy /b htdocs\vgmPlay3.js + vgm_adapter.js htdocs\backend_vgm.js && del htdocs\vgmPlay3.js

:END