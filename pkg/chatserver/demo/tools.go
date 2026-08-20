package demo

import (
	"context"
	"fmt"
	"strings"

	geptools "github.com/go-go-golems/geppetto/pkg/inference/tools"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
	"github.com/pkg/errors"
)

// Tool names a real model can call to learn the demo world. Their results are
// plain JSON; the pbuichat projection rule turns the rows into a table widget.
const (
	ToolProducts = "shop_products"
	ToolProduct  = "shop_product"
)

// ProductsInput filters the inventory.
type ProductsInput struct {
	Category string `json:"category,omitempty" jsonschema:"description=Only this category id (e.g. 7 for American Gold Eagles)"`
	Metal    string `json:"metal,omitempty" jsonschema:"description=Only this metal slug: gold, silver, platinum"`
	LowStock bool   `json:"low_stock,omitempty" jsonschema:"description=Only products at or below their reorder threshold"`
}

// ProductRow is one inventory row as the model sees it.
type ProductRow struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Category  string  `json:"category"`
	Metal     string  `json:"metal"`
	Qty       int     `json:"qty"`
	ReorderAt int     `json:"reorder_at"`
	Price     float64 `json:"price"`
	Sold30d   int     `json:"sold_30d"`
}

// ProductsOutput is the shop_products result.
type ProductsOutput struct {
	Rows []ProductRow `json:"rows"`
	Hint string       `json:"hint"`
}

// ProductInput selects one product.
type ProductInput struct {
	ID string `json:"id" jsonschema:"required,description=products.id"`
}

// ProductOutput is the shop_product result.
type ProductOutput struct {
	Product   map[string]any `json:"product,omitempty"`
	Category  map[string]any `json:"category,omitempty"`
	LastOrder map[string]any `json:"last_order,omitempty"`
	Error     string         `json:"error,omitempty"`
}

// RegisterTools adds the demo data tools to a geppetto registry.
func RegisterTools(registry geptools.ToolRegistry) error {
	products, err := geptools.NewToolFromFunc(ToolProducts,
		"List the shop's coin inventory (ids, names, quantities, reorder thresholds, prices, 30-day sales). Mention products as [[product:<id>|<name>]].",
		func(_ context.Context, in ProductsInput) (ProductsOutput, error) {
			out := ProductsOutput{Hint: "mention products as [[product:<id>|<name>]], categories as [[category:<id>|<name>]], metals as [[metal:<slug>|<slug>]]"}
			for _, p := range Products {
				if in.Category != "" && p.Category != in.Category {
					continue
				}
				if in.Metal != "" && !strings.EqualFold(p.Metal, in.Metal) {
					continue
				}
				if in.LowStock && p.Qty > p.ReorderAt {
					continue
				}
				out.Rows = append(out.Rows, ProductRow{ID: p.ID, Name: p.Name, Category: p.Category, Metal: p.Metal, Qty: p.Qty, ReorderAt: p.ReorderAt, Price: p.Price, Sold30d: sum(p.Sold30d)})
			}
			return out, nil
		})
	if err != nil {
		return errors.Wrap(err, ToolProducts)
	}
	product, err := geptools.NewToolFromFunc(ToolProduct,
		"Details of one product by id, with its category and last order.",
		func(_ context.Context, in ProductInput) (ProductOutput, error) {
			p, ok := ProductByID(strings.TrimSpace(in.ID))
			if !ok {
				return ProductOutput{Error: fmt.Sprintf("no product %q", in.ID)}, nil
			}
			return ProductOutput{Product: p.asMap(), Category: Categories[p.Category], LastOrder: Orders[p.LastOrder]}, nil
		})
	if err != nil {
		return errors.Wrap(err, ToolProduct)
	}
	for _, t := range []*geptools.ToolDefinition{products, product} {
		if err := registry.RegisterTool(t.Name, *t); err != nil {
			return errors.Wrap(err, t.Name)
		}
	}
	return nil
}

// ProjectionRules are the tool-result projections for the demo tools.
func ProjectionRules() []pbuichat.ProjectionRule {
	return []pbuichat.ProjectionRule{pbuichat.RowsToTable(ToolProducts, "rows")}
}

func sum(in []int) int {
	s := 0
	for _, v := range in {
		s += v
	}
	return s
}
