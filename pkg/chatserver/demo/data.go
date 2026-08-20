// Package demo holds the reference product the pbui-chat binary ships: a small
// gold-coin shop vocabulary, an in-memory resolver over a few SKUs, and the
// vocabulary.json the TypeScript demo exports (kept byte-identical by a test
// on each side).
package demo

import (
	_ "embed"

	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
)

//go:embed vocabulary.json
var VocabularyJSON []byte

// Vocabulary parses the embedded vocabulary.
func Vocabulary() (*pbuichat.Vocabulary, error) {
	return pbuichat.ParseVocabulary(VocabularyJSON)
}

// Product is one SKU in the demo inventory.
type Product struct {
	ID        string
	Name      string
	Category  string
	Metal     string
	Qty       int
	ReorderAt int
	Price     float64
	Cost      float64
	Sold30d   []int
	LastOrder string
}

// Products is the demo inventory. Quantities are chosen so that "low stock"
// questions have a clear answer.
var Products = []Product{
	{ID: "2049", Name: "1oz American Gold Eagle 2024", Category: "7", Metal: "gold", Qty: 3, ReorderAt: 5, Price: 2410, Cost: 2201.18, Sold30d: []int{3, 4, 6, 9, 12, 9, 6, 4, 3, 4, 6, 9}, LastOrder: "88213"},
	{ID: "2051", Name: "1/2oz American Gold Eagle 2024", Category: "7", Metal: "gold", Qty: 1, ReorderAt: 4, Price: 1260, Cost: 1150.5, Sold30d: []int{1, 2, 2, 3, 2, 1, 2, 3, 4, 2, 1, 2}, LastOrder: "88201"},
	{ID: "2077", Name: "1/10oz American Gold Eagle 2024", Category: "7", Metal: "gold", Qty: 0, ReorderAt: 10, Price: 265, Cost: 238.9, Sold30d: []int{8, 7, 9, 12, 10, 8, 6, 5, 4, 3, 2, 1}, LastOrder: "88190"},
	{ID: "3110", Name: "1oz Canadian Gold Maple 2024", Category: "8", Metal: "gold", Qty: 14, ReorderAt: 5, Price: 2395, Cost: 2190, Sold30d: []int{2, 3, 3, 4, 5, 4, 3, 3, 4, 5, 6, 5}, LastOrder: "88210"},
	{ID: "2301", Name: "1oz American Gold Buffalo 2024", Category: "9", Metal: "gold", Qty: 7, ReorderAt: 5, Price: 2430, Cost: 2220, Sold30d: []int{1, 1, 2, 2, 3, 2, 2, 1, 2, 3, 3, 2}, LastOrder: "88177"},
	{ID: "4001", Name: "1oz American Silver Eagle 2024", Category: "10", Metal: "silver", Qty: 420, ReorderAt: 100, Price: 36.5, Cost: 31.2, Sold30d: []int{40, 45, 50, 38, 42, 55, 60, 48, 44, 41, 39, 52}, LastOrder: "88214"},
	{ID: "4002", Name: "1oz Silver Maple 2024", Category: "11", Metal: "silver", Qty: 85, ReorderAt: 100, Price: 35.9, Cost: 30.8, Sold30d: []int{20, 22, 25, 18, 21, 27, 30, 24, 22, 20, 19, 26}, LastOrder: "88209"},
	{ID: "5001", Name: "1oz Platinum Eagle 2024", Category: "12", Metal: "platinum", Qty: 2, ReorderAt: 3, Price: 1120, Cost: 1040, Sold30d: []int{0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0}, LastOrder: "88150"},
}

// Categories, Metals, Orders and Sources complete the demo world.
var Categories = map[string]map[string]any{
	"7":  {"name": "American Gold Eagles", "products": 3},
	"8":  {"name": "Canadian Gold Maples", "products": 1},
	"9":  {"name": "American Gold Buffalos", "products": 1},
	"10": {"name": "American Silver Eagles", "products": 1},
	"11": {"name": "Canadian Silver Maples", "products": 1},
	"12": {"name": "Platinum Eagles", "products": 1},
}

var Metals = map[string]map[string]any{
	"gold":     {"name": "gold", "spotUsd": 2298.4, "shareOfStockValue": 61},
	"silver":   {"name": "silver", "spotUsd": 27.1, "shareOfStockValue": 26},
	"platinum": {"name": "platinum", "spotUsd": 972.0, "shareOfStockValue": 13},
}

var Orders = map[string]map[string]any{
	"88213": {"customer": "J. Alvarez", "total": 7230, "items": 3, "placedAt": "2026-08-18", "status": "shipped"},
	"88214": {"customer": "Northgate Capital", "total": 14600, "items": 400, "placedAt": "2026-08-19", "status": "paid"},
	"88201": {"customer": "M. Okafor", "total": 1260, "items": 1, "placedAt": "2026-08-12", "status": "shipped"},
	"88190": {"customer": "T. Nguyen", "total": 795, "items": 3, "placedAt": "2026-08-05", "status": "shipped"},
}

var Sources = map[string]map[string]any{
	"E1": {"title": "pricing-policy.md §3", "locator": "knowledge/pricing-policy.md#reorder-thresholds", "kind": "document"},
	"E2": {"title": "sql: orders last 30 days", "locator": "sql_query tc_31", "kind": "query"},
	"E3": {"title": "inventory snapshot 2026-08-20", "locator": "sql_query tc_29", "kind": "query"},
}

// ProductByID looks up a product.
func ProductByID(id string) (Product, bool) {
	for _, p := range Products {
		if p.ID == id {
			return p, true
		}
	}
	return Product{}, false
}

// LowStock returns products at or below their reorder threshold.
func LowStock() []Product {
	var out []Product
	for _, p := range Products {
		if p.Qty <= p.ReorderAt {
			out = append(out, p)
		}
	}
	return out
}

func (p Product) asMap() map[string]any {
	return map[string]any{
		"id": p.ID, "name": p.Name, "category": p.Category, "metal": p.Metal,
		"qty": p.Qty, "reorderAt": p.ReorderAt, "price": p.Price, "cost": p.Cost,
		"lastOrder": p.LastOrder, "sold30d": intsToAny(p.Sold30d),
	}
}

func intsToAny(in []int) []any {
	out := make([]any, len(in))
	for i, v := range in {
		out[i] = v
	}
	return out
}

// Resolver builds the demo resolver over the in-memory world.
func Resolver() pbuichat.Resolver {
	products := map[string]map[string]any{}
	for _, p := range Products {
		products[p.ID] = p.asMap()
	}
	return pbuichat.ResolverMux{
		"product":  pbuichat.NewStaticResolver(products),
		"category": pbuichat.NewStaticResolver(Categories),
		"metal":    pbuichat.NewStaticResolver(Metals),
		"order":    pbuichat.NewStaticResolver(Orders),
		"source":   pbuichat.NewStaticResolver(Sources),
	}
}
