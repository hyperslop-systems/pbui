.PHONY: lint lintmax fmt-check docker-lint gosec govulncheck test build \
	ci-check logcopter-generate logcopter-check glazed-lint \
	protocol-generate protocol-check frontend-check \
	chat-ui chat-build chat-serve chat-test

GO_PACKAGES ?= ./...
LOGCOPTER_PACKAGES ?= ./pkg/...
GLAZED_LINT_FLAGS ?=

lint:
	GOWORK=off golangci-lint run -v

lintmax:
	GOWORK=off golangci-lint run -v --max-same-issues=100

fmt-check:
	GOWORK=off golangci-lint fmt --diff

docker-lint:
	docker run --rm -v $(shell pwd):/app -w /app golangci/golangci-lint:v2.12.2 golangci-lint run -v

gosec:
	GOWORK=off go install github.com/securego/gosec/v2/cmd/gosec@latest
	gosec -exclude-generated -exclude=G101,G304,G301,G306 -exclude-dir=.history $(GO_PACKAGES)

govulncheck:
	GOWORK=off go install golang.org/x/vuln/cmd/govulncheck@latest
	govulncheck $(GO_PACKAGES)

test:
	GOWORK=off go test $(GO_PACKAGES)

build:
	GOWORK=off go generate $(GO_PACKAGES)
	GOWORK=off go build $(GO_PACKAGES)

ci-check: fmt-check lint logcopter-check glazed-lint test build

# Shared by GitHub CI and Lefthook. Keep this ordered: workspace packages
# export uncommitted dist declarations, and tests must use current builds.
# Lint first so formatting failures are reported before the expensive checks.
frontend-check:
	pnpm --filter @hyperslop-systems/datalab-ui lint
	pnpm --filter @hyperslop-systems/workbench-protocol build
	pnpm --workspace-root run typecheck
	pnpm --workspace-root run test
	pnpm --workspace-root run build
	pnpm --filter @hyperslop-systems/workbench-core typecheck
	pnpm --filter @hyperslop-systems/workbench-core test
	pnpm --filter @hyperslop-systems/workbench-core build
	pnpm --filter @hyperslop-systems/pbui-workbench typecheck
	pnpm --filter @hyperslop-systems/pbui-workbench test
	pnpm --filter @hyperslop-systems/pbui-workbench build
	pnpm --filter @hyperslop-systems/datalab-ui typecheck
	pnpm --filter @hyperslop-systems/datalab-ui test
	pnpm --filter @hyperslop-systems/datalab-ui build

logcopter-generate:
	GOWORK=off go generate $(GO_PACKAGES)

logcopter-check:
	GOWORK=off go tool logcopter-gen \
		-area-prefix hyperslop-systems.pbui \
		-strip-prefix github.com/hyperslop-systems/pbui \
		-check $(LOGCOPTER_PACKAGES)

glazed-lint:
	GOWORK=off go tool glazed-lint $(GLAZED_LINT_FLAGS) $(GO_PACKAGES)

# Two buf templates: the workbench protocol feeds @hyperslop-systems/workbench-protocol,
# the chat protocol feeds @hyperslop-systems/pbui-chat. Both emit Go into gen/go.
protocol-generate:
	buf generate --template buf.gen.yaml --path proto/hyperslop/pbui/workbench
	buf generate --template buf.gen.chat.yaml --path proto/hyperslop/pbui/chat

protocol-check:
	buf lint
	$(MAKE) protocol-generate
	git diff --exit-code -- gen/go packages/workbench-protocol/src/generated packages/pbui-chat/src/generated

# ── pbui-chat: the PBUI-native chat agent (cmd/pbui-chat) ────────────────────
# Install JS deps once with: pnpm install --filter '!@hyperslop-systems/datalab-ui'

chat-ui:
	pnpm --include-workspace-root --filter @hyperslop-systems/pbui build
	pnpm --filter @hyperslop-systems/pbui-workbench build
	pnpm --filter @hyperslop-systems/pbui-sandbox build
	pnpm --filter @hyperslop-systems/pbui-chat build
	pnpm --filter @hyperslop-systems/pbui-chat-demo build

chat-build: chat-ui
	GOWORK=off go build -tags embed -o bin/pbui-chat ./cmd/pbui-chat

chat-serve:
	GOWORK=off go run ./cmd/pbui-chat serve --port 8090

chat-test:
	GOWORK=off go test ./pkg/pbuichat/... ./pkg/chatserver/... ./pkg/chatui/... ./cmd/pbui-chat/...
	pnpm --filter @hyperslop-systems/pbui-chat test
