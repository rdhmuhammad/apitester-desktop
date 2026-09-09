//go:build !windows

package restrequest

import "os"

func atomicReplace(source, destination string) error {
	return os.Rename(source, destination)
}
