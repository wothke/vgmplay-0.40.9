/*
* This file adapts "vgmplay" to the interface expected by my generic JavaScript player..
*
* Copyright (C) 2015 Juergen Wothke
*
* LICENSE
* 
* This library is free software; you can redistribute it and/or modify it
* under the terms of the GNU General Public License as published by
* the Free Software Foundation; either version 2.1 of the License, or (at
* your option) any later version. This library is distributed in the hope
* that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
* warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU General Public License for more details.
* 
* You should have received a copy of the GNU General Public
* License along with this library; if not, write to the Free Software
* Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA
*/

#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>     /* malloc, free, rand */

//#include <math.h>  // ldexp
/*
double ldexp (double x, int exp) { // for some reason used emscripten misses this though nobody is using it.. only when compiling without optimizations..
	return 0;
}
*/
typedef unsigned char UINT8; 
typedef signed char INT8; 
typedef unsigned short UINT16; 
typedef signed short INT16; 
typedef unsigned int UINT32; 
typedef signed int INT32;
typedef unsigned long UINT64; 
typedef signed long INT64;


#include "stdbool.h"
#include "VGMPlay.h"
#include "VGMPlay_Intf.h"

extern void VGMPlay_Init(void);
extern void VGMPlay_Init2(void);
extern void VGMPlay_Deinit(void);
extern bool OpenVGMFile(const char* FileName);
extern void CloseVGMFile(void);

extern void PlayVGM(void);
extern void StopVGM(void);
extern UINT32 FillBuffer(WAVE_16BS* Buffer, UINT32 BufferSize);

extern void PlayVGM_Emscripten(void);
extern void StopVGM_Emscripten(void);
extern bool IsEndPlay_Emscripten(void);
extern UINT32 FillBuffer_Emscripten(WAVE_16BS* Buffer, UINT32 BufferSize);

extern GD3_TAG VGMTag;
extern UINT32 SampleRate;
extern bool EndPlay;
extern UINT8 FileMode;
extern UINT8 BoostVolume;
extern VGM_HEADER VGMHead;
extern INT32 VGMSmplPlayed;
extern UINT32 VGMPos;
extern UINT32 VGMMaxLoopM;
extern UINT32 VGMCurLoop;
extern UINT32 PlayingTime;
extern INT32 VGMSampleRate;

extern void SeekVGM(bool Relative, INT32 PlayBkSamples);
extern INT32 SampleVGM2Playback(INT32 SampleVal);
extern UINT32 CalcSampleMSec(UINT64 Value, UINT8 Mode);
extern UINT32 CalcSampleMSecExt(UINT64 Value, UINT8 Mode, VGM_HEADER* FileHead);

extern UINT32 FadeTime;
extern UINT32 PauseTime;


// reuse utils from original UI
extern void ReadOptions(const char* filename);
extern const wchar_t* GetTagStrEJ(const wchar_t* EngTag, const wchar_t* JapTag);
extern const char * GetChipsInfo(void);

/*
#ifdef EMSCRIPTEN
#define EMSCRIPTEN_KEEPALIVE __attribute__((used))
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
*/
#define BUF_SIZE	1024
#define TEXT_MAX	255*4
#define NUM_MAX	15

// see Sound::Sample::CHANNELS
#define CHANNELS 2				
#define BYTES_PER_SAMPLE 2
#define SAMPLE_BUF_SIZE	8192
WAVE_16BS sample_buffer[SAMPLE_BUF_SIZE ];
int samples_available= 0;
INT32 max_pos= -1;

char title_str[TEXT_MAX];
char author_str[TEXT_MAX];
char desc_str[TEXT_MAX];
char notes_str[TEXT_MAX];
char tracks_str[TEXT_MAX];
char chips_str[TEXT_MAX];
char program_str[NUM_MAX];

typedef struct Info{
    const char* info_texts[7];
} Info;

static struct Info info = {
	.info_texts[0]= title_str,
	.info_texts[1]= author_str,
	.info_texts[2]= desc_str,
	.info_texts[3]= notes_str,
	.info_texts[4]= program_str,
	.info_texts[5]= chips_str,
	.info_texts[6]= tracks_str
};

extern void emu_teardown (void)  __attribute__((noinline));
extern void EMSCRIPTEN_KEEPALIVE emu_teardown (void) {
	StopVGM();
	CloseVGMFile();
	VGMPlay_Deinit();
}

char ini_file[TEXT_MAX];
char music_file[TEXT_MAX];

extern int emu_init(int sample_rate, char *basedir, char *songmodule) __attribute__((noinline));
extern EMSCRIPTEN_KEEPALIVE int emu_init(int sample_rate, char *basedir, char *songmodule)
{
	emu_teardown();
	
	VGMPlay_Init();
	snprintf(ini_file, TEXT_MAX, "VGMPlay.ini");
	ReadOptions(ini_file);	// XXX FIXME not async!
	
	SampleRate = sample_rate;	// override whatever may be hardcoded in the config.. by using what is needed by WebAudio later resampling is avoided
	
	VGMPlay_Init2();
		
	snprintf(music_file, TEXT_MAX, "%s/%s", basedir, songmodule);
	if(!OpenVGMFile(music_file))
		return -1;
	return 0;
}

extern int emu_get_sample_rate() __attribute__((noinline));
extern EMSCRIPTEN_KEEPALIVE int emu_get_sample_rate()
{
	return SampleRate;
}

extern int emu_set_subsong(int subsong, int boostVolume) __attribute__((noinline));
extern int EMSCRIPTEN_KEEPALIVE emu_set_subsong(int subsong, int boostVolume) {
	PlayVGM();
	
	BoostVolume= boostVolume;	// hack to force louder playback
	max_pos= -1;

	return 0;
}

int len_wstr(const wchar_t *crap) {
	// note: wchar_t is 4 bytes..
	int len=0;
	wchar_t c;
	for (;(c = *crap); len++, crap++);
	
	return len;
}

#include <string.h>
void copy_string(const char *dest, const wchar_t *src) {
	memcpy(dest, src, (len_wstr(src)+1)*sizeof(wchar_t));
}

extern const char** emu_get_track_info() __attribute__((noinline));
extern const char** EMSCRIPTEN_KEEPALIVE emu_get_track_info() {	
	const wchar_t* TitleTag= GetTagStrEJ(VGMTag.strTrackNameE, VGMTag.strTrackNameJ);
	const wchar_t* GameTag = GetTagStrEJ(VGMTag.strGameNameE, VGMTag.strGameNameJ);
	const wchar_t* AuthorTag = GetTagStrEJ(VGMTag.strAuthorNameE, VGMTag.strAuthorNameJ);
	const wchar_t* SystemTag = GetTagStrEJ(VGMTag.strSystemNameE, VGMTag.strSystemNameJ);

	copy_string(title_str, TitleTag);
	copy_string(author_str, AuthorTag);
	copy_string(desc_str, GameTag);
	copy_string(notes_str, VGMTag.strNotes);
	memcpy(program_str, SystemTag, len_wstr(SystemTag)*sizeof(wchar_t));
	
	snprintf(tracks_str, NUM_MAX, "%d",  1);
	
	const char* chips = 	GetChipsInfo();
	snprintf(chips_str, TEXT_MAX, "%s",  chips);
		
	return info.info_texts;
}

extern char* EMSCRIPTEN_KEEPALIVE emu_get_audio_buffer(void) __attribute__((noinline));
extern char* EMSCRIPTEN_KEEPALIVE emu_get_audio_buffer(void) {
	return (char*)sample_buffer;
}

extern long EMSCRIPTEN_KEEPALIVE emu_get_audio_buffer_length(void) __attribute__((noinline));
extern long EMSCRIPTEN_KEEPALIVE emu_get_audio_buffer_length(void) {
	return samples_available;
}

int GetFileLength(VGM_HEADER* FileHead)
{
	UINT32 SmplCnt;
	
	if (! VGMMaxLoopM && FileHead->lngLoopSamples)
		return -1000;
	
	// Note: SmplCnt is ALWAYS 44.1 KHz, VGM's native sample rate
	SmplCnt = FileHead->lngTotalSamples + FileHead->lngLoopSamples * (VGMMaxLoopM - 0x01);
	
	INT32 fadeMSec;	
	if (FileHead->lngLoopSamples)
		fadeMSec = FadeTime + PauseTime;
	else
		fadeMSec = PauseTime;

	return SmplCnt + (fadeMSec/1000*VGMSampleRate);
}

extern INT32 EMSCRIPTEN_KEEPALIVE emu_get_max_position(void) __attribute__((noinline));
extern INT32 EMSCRIPTEN_KEEPALIVE emu_get_max_position(void) {
	if (max_pos<0) {
		INT32 l= GetFileLength(&VGMHead);
		max_pos= SampleVGM2Playback(l);
	}
	return max_pos;
}

extern int EMSCRIPTEN_KEEPALIVE emu_seek_position(INT32 pos) __attribute__((noinline));
extern int EMSCRIPTEN_KEEPALIVE emu_seek_position(INT32 pos) {
	if (pos > emu_get_max_position()) {
		return -1;
	}
	SeekVGM(false, pos);
	return 0;
}

extern INT32 EMSCRIPTEN_KEEPALIVE emu_get_position(void) __attribute__((noinline));
extern INT32 EMSCRIPTEN_KEEPALIVE emu_get_position(void) {
	return PlayingTime;
}


extern int emu_compute_audio_samples() __attribute__((noinline));
extern int EMSCRIPTEN_KEEPALIVE emu_compute_audio_samples() {
	if (!EndPlay) {
		int size= FillBuffer(sample_buffer, SAMPLE_BUF_SIZE);
		if (size) {
			samples_available= size;
			return 0;	// we might want to handle errors (-1) separately..
		}
	}

	StopVGM();
	return 1;
}

