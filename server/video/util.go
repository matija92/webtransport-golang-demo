package video

import (
	"io"
	"log"
	"math"
	"os"
	"sort"
	"strings"
)

const FrameRate = float64(1) / 30

func LoadFramesFromDisk(dir string) []*Frame {
	files, err := os.ReadDir(dir)
	if err != nil {
		log.Fatal(err)
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Name() < files[j].Name()
	})

	frames := make([]*Frame, 0)
	for i, file := range files {

		if !file.IsDir() {
			f, _ := os.Open(dir + file.Name())
			data, err := io.ReadAll(f)
			if err != nil {
				log.Fatal(err)
			}

			t := Delta
			// Keyframes have .key.h264 extension
			if strings.Contains(".key.h264", file.Name()) {
				t = Key
			}

			header := FrameHeader{
				Type:      t,
				Timestamp: uint64(math.Trunc(float64(i) * FrameRate * 1000000)), // in microseconds
				Size:      uint32(len(data)),
			}

			frames = append(frames, &Frame{
				Header: header,
				Data:   data,
			})

		}

	}

	return frames
}
