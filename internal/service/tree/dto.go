package tree

type RequestTree struct {
	ID       string        `json:"id"`
	Name     string        `json:"name"`
	Item     []RequestTree `json:"item,omitempty"`
	IsActive bool          `json:"isActive"`
	Method   string        `json:"method,omitempty"`
	Category string        `json:"category"`
}
