package workbench

import "fmt"

// ValidationError identifies a stable validation failure class and path.
type ValidationError struct {
	Code   string
	Path   string
	Detail string
}

func (e *ValidationError) Error() string {
	if e.Path == "" {
		return fmt.Sprintf("workbench: %s: %s", e.Code, e.Detail)
	}
	return fmt.Sprintf("workbench: %s at %s: %s", e.Code, e.Path, e.Detail)
}

func invalid(code, path, format string, args ...any) error {
	return &ValidationError{
		Code:   code,
		Path:   path,
		Detail: fmt.Sprintf(format, args...),
	}
}
