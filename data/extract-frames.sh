#!/bin/bash
FILE=./sample/640/sample-640.mp4
FRAME_DIR=./sample/640/frames

mkdir -p $FRAME_DIR

ffmpeg -i $FILE -f h264 $FILE.h264

# First 900 frames
for i in {0001..0901}
do
   ffmpeg -i $FILE.h264 -c:v libx264 -filter:v "select=gte(n\,$i)" -frames:v 1 -f h264 $FRAME_DIR/frame-$i.h264
done