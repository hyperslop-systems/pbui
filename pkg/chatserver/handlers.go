package chatserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	chatapp "github.com/go-go-golems/pinocchio/pkg/chatapp"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/frontendtools"
	toolv1 "github.com/go-go-golems/pinocchio/pkg/chatapp/pb/proto/pinocchio/chatapp/frontendtools/v1"
	chatappv1 "github.com/go-go-golems/pinocchio/pkg/chatapp/pb/proto/pinocchio/chatapp/v1"
	"github.com/go-go-golems/pinocchio/pkg/chatapp/serverkit"
	sessionstream "github.com/go-go-golems/sessionstream/pkg/sessionstream"
	"github.com/google/uuid"
	"github.com/hyperslop-systems/pbui/pkg/chatserver/demo"
	"github.com/hyperslop-systems/pbui/pkg/chatserver/scripted"
	"github.com/hyperslop-systems/pbui/pkg/pbuichat"
	"google.golang.org/protobuf/types/known/structpb"
)

const maxBodyBytes = 1 << 20

// submitMessageRequest is the app-owned message body: chat-provider's
// {prompt, attachments} plus the PBUI additions {refs, focus}.
type submitMessageRequest struct {
	Prompt      string                    `json:"prompt"`
	Attachments []serverkit.AttachmentRef `json:"attachments,omitempty"`
	Refs        []pbuichat.Reference      `json:"refs,omitempty"`
	Focus       *pbuichat.Focus           `json:"focus,omitempty"`
}

type toolDescriptorRequest struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	InputSchema map[string]any `json:"inputSchema,omitempty"`
	Mode        string         `json:"mode,omitempty"`
	Available   bool           `json:"available"`
}

type toolManifestRequest struct {
	ClientInstanceID string                  `json:"clientInstanceId"`
	ConnectionID     string                  `json:"connectionId"`
	Revision         uint64                  `json:"revision,omitempty"`
	Tools            []toolDescriptorRequest `json:"tools"`
}

type frontendToolExecutor struct {
	ClientInstanceID string `json:"clientInstanceId"`
	ConnectionID     string `json:"connectionId"`
	AssignmentID     string `json:"assignmentId"`
}

type toolResultRequest struct {
	ToolCallID string               `json:"toolCallId"`
	ToolName   string               `json:"toolName,omitempty"`
	Result     map[string]any       `json:"result,omitempty"`
	Status     string               `json:"status,omitempty"`
	Error      string               `json:"error,omitempty"`
	Executor   frontendToolExecutor `json:"executor"`
}

type listSessionsResponse struct {
	Sessions []SessionRecord `json:"sessions"`
}

type retitleSessionRequest struct {
	Title            string `json:"title"`
	ExpectedRevision uint64 `json:"expectedRevision"`
}

type acceptedResponse struct {
	SessionID string                `json:"sessionId"`
	Accepted  bool                  `json:"accepted"`
	Status    string                `json:"status"`
	Revision  uint64                `json:"revision,omitempty"`
	Executor  *frontendToolExecutor `json:"executor,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, serverkit.ErrorResponse{Error: msg})
}

func decodeJSON(r *http.Request, v any) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes))
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		return nil
	}
	return json.Unmarshal(body, v)
}

func sessionIDFrom(r *http.Request) sessionstream.SessionId {
	return sessionstream.SessionId(strings.TrimSpace(r.PathValue("id")))
}

// HandleHealth reports liveness.
func (s *Server) HandleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "realRuntime": s.real != nil})
}

// HandleVocabulary serves the product vocabulary the browser validates against.
func (s *Server) HandleVocabulary(w http.ResponseWriter, _ *http.Request) {
	if s.opts.Vocabulary == nil {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(demo.VocabularyJSON)
		return
	}
	writeJSON(w, http.StatusOK, s.opts.Vocabulary)
}

// HandleCreateSession mints a session id. Sessions are created lazily by the hub.
func (s *Server) HandleCreateSession(w http.ResponseWriter, r *http.Request) {
	var in serverkit.CreateSessionRequest
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	id := uuid.NewString()
	principal, _ := principalFromContext(r.Context())
	if err := s.authorizer.ClaimSession(r.Context(), principal, sessionstream.SessionId(id)); err != nil {
		writeError(w, http.StatusInternalServerError, "could not claim session")
		return
	}
	// The index is a convenience: a session works whether or not it is
	// remembered, so a failure here is logged and the id still goes back.
	if err := s.sessions.Remember(r.Context(), id, time.Now()); err != nil {
		log.Warn().Err(err).Str("session_id", id).Msg("pbui-chat: could not index the new session")
	}
	writeJSON(w, http.StatusOK, serverkit.CreateSessionResponse{SessionID: id})
}

// HandleListSessions returns what this server has seen, most recently active
// first. The browser MERGES this into its own records rather than replacing
// them: the index may be empty after a restart while the browser still knows
// session ids that hydrate perfectly.
func (s *Server) HandleListSessions(w http.ResponseWriter, r *http.Request) {
	records, err := s.sessions.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	principal, _ := principalFromContext(r.Context())
	authorized := make([]SessionRecord, 0, len(records))
	for _, record := range records {
		if s.authorizer.CanAccessSession(r.Context(), principal, sessionstream.SessionId(record.ID), SessionRead) {
			authorized = append(authorized, record)
		}
	}
	writeJSON(w, http.StatusOK, listSessionsResponse{Sessions: authorized})
}

// HandleRetitleSession stores a title for a session. Titles live in the
// browser first; this is what lets a SECOND browser show something better
// than a uuid.
func (s *Server) HandleRetitleSession(w http.ResponseWriter, r *http.Request) {
	sid := sessionIDFrom(r)
	if sid == "" {
		writeError(w, http.StatusBadRequest, "missing session id")
		return
	}
	var in retitleSessionRequest
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	record, err := s.sessions.Retitle(r.Context(), string(sid), in.Title, in.ExpectedRevision)
	if err != nil {
		var conflict *TitleRevisionConflict
		if errors.As(err, &conflict) {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":         conflict.Error(),
				"id":            string(sid),
				"title":         conflict.Current.Title,
				"titleRevision": conflict.Current.TitleRevision,
			})
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":            string(sid),
		"title":         record.Title,
		"titleRevision": record.TitleRevision,
	})
}

// HandleSubmitMessage starts a run. With the scripted engine the refs travel
// beside the prompt; with the real runtime they are rendered as a pbui-refs
// section after the user's words so the model sees typed objects.
func (s *Server) HandleSubmitMessage(w http.ResponseWriter, r *http.Request) {
	sid := sessionIDFrom(r)
	if sid == "" {
		writeError(w, http.StatusBadRequest, "missing session id")
		return
	}
	var in submitMessageRequest
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	prompt := strings.TrimSpace(in.Prompt)
	attachments := make([]chatapp.Attachment, 0, len(in.Attachments))
	for _, ref := range in.Attachments {
		id := strings.TrimSpace(ref.AttachmentID)
		if id == "" {
			writeError(w, http.StatusBadRequest, "attachment_id must not be empty")
			return
		}
		attachments = append(attachments, chatapp.Attachment{ID: id, Kind: chatapp.AttachmentKindImage})
	}
	if prompt == "" && len(attachments) == 0 {
		writeError(w, http.StatusBadRequest, "missing prompt or attachments")
		return
	}
	if err := s.plugin.HydrateTrace(r.Context(), sid); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.sessions.Touch(r.Context(), string(sid), time.Now(), true); err != nil {
		log.Warn().Err(err).Str("session_id", string(sid)).Msg("pbui-chat: could not index the message")
	}
	if s.real != nil {
		req, err := s.real.promptRequest(r.Context(), sid, prompt+pbuichat.RenderRefsSuffix(in.Refs, in.Focus))
		if err != nil {
			log.Error().Err(err).Str("session_id", string(sid)).Msg("pbui-chat: build real prompt request")
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		req.Attachments = attachments
		if err := s.service.SubmitPromptRequest(r.Context(), sid, req); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, acceptedResponse{SessionID: string(sid), Accepted: true, Status: "running"})
		return
	}
	s.scripted.SetPendingContext(sid, in.Refs, in.Focus)
	if err := s.hub.Submit(r.Context(), sid, scripted.CommandStart, &chatappv1.StartInferenceCommand{
		Prompt:      prompt,
		Attachments: chatapp.AttachmentsToProto(attachments),
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, acceptedResponse{SessionID: string(sid), Accepted: true, Status: "running"})
}

// HandleStopSession cancels the active run.
func (s *Server) HandleStopSession(w http.ResponseWriter, r *http.Request) {
	sid := sessionIDFrom(r)
	if sid == "" {
		writeError(w, http.StatusBadRequest, "missing session id")
		return
	}
	if s.real != nil {
		if err := s.service.Stop(r.Context(), sid); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else if err := s.hub.Submit(r.Context(), sid, scripted.CommandStop, &chatappv1.StopInferenceCommand{}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, acceptedResponse{SessionID: string(sid), Accepted: true, Status: "stop_requested"})
}

// HandleSessionSnapshot returns the hydrated timeline over HTTP.
func (s *Server) HandleSessionSnapshot(w http.ResponseWriter, r *http.Request) {
	sid := sessionIDFrom(r)
	if sid == "" {
		writeError(w, http.StatusBadRequest, "missing session id")
		return
	}
	snap, err := s.service.Snapshot(r.Context(), sid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, serverkit.EncodeSnapshotResponse(snap, func([]serverkit.SnapshotEntity) string { return "idle" }))
}

// HandleToolManifest replaces the browser-side tool manifest for a session.
func (s *Server) HandleToolManifest(w http.ResponseWriter, r *http.Request) {
	sid := sessionIDFrom(r)
	if sid == "" {
		writeError(w, http.StatusBadRequest, "missing session id")
		return
	}
	var in toolManifestRequest
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	tools := make([]*toolv1.FrontendToolDescriptor, 0, len(in.Tools))
	for _, t := range in.Tools {
		name := strings.TrimSpace(t.Name)
		if name == "" {
			continue
		}
		schema, err := structpb.NewStruct(t.InputSchema)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad input schema")
			return
		}
		tools = append(tools, &toolv1.FrontendToolDescriptor{Name: name, Description: t.Description, InputSchema: schema, Mode: parseToolMode(t.Mode), Available: t.Available})
	}
	updated, err := s.frontendTools.AcceptManifest(r.Context(), sid, s.hub, &toolv1.FrontendToolManifestCommand{
		Tools:            tools,
		Revision:         in.Revision,
		ClientInstanceId: strings.TrimSpace(in.ClientInstanceID),
		ConnectionId:     strings.TrimSpace(in.ConnectionID),
	})
	if err != nil {
		writeError(w, toolManifestErrorStatus(err), err.Error())
		return
	}
	executor := frontendToolExecutorFromProto(updated.GetExecutor())
	writeJSON(w, http.StatusOK, acceptedResponse{
		SessionID: string(sid),
		Accepted:  true,
		Status:    "manifest_updated",
		Revision:  updated.GetRevision(),
		Executor:  &executor,
	})
}

// HandleToolResult delivers a browser tool result (accept, proposal, …).
func (s *Server) HandleToolResult(w http.ResponseWriter, r *http.Request) {
	sid := sessionIDFrom(r)
	if sid == "" {
		writeError(w, http.StatusBadRequest, "missing session id")
		return
	}
	var in toolResultRequest
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	if strings.TrimSpace(in.ToolCallID) == "" {
		writeError(w, http.StatusBadRequest, "missing toolCallId")
		return
	}
	result, err := structpb.NewStruct(in.Result)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad result")
		return
	}
	status := strings.TrimSpace(in.Status)
	if status == "" {
		status = "success"
	}
	if err := s.hub.Submit(r.Context(), sid, frontendtools.CommandResult, &toolv1.FrontendToolResultCommand{ToolCallId: strings.TrimSpace(in.ToolCallID), ToolName: strings.TrimSpace(in.ToolName), Result: result, Status: status, Error: in.Error, Executor: in.Executor.toProto()}); err != nil {
		writeError(w, toolResultErrorStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, acceptedResponse{SessionID: string(sid), Accepted: true, Status: "result_received"})
}

func toolManifestErrorStatus(err error) int {
	code, ok := frontendtools.ManifestErrorCodeOf(err)
	if !ok {
		return http.StatusInternalServerError
	}
	switch code {
	case frontendtools.ManifestErrorIdentityMissing, frontendtools.ManifestErrorIdentityTooLong:
		return http.StatusBadRequest
	case frontendtools.ManifestErrorRevisionRegression, frontendtools.ManifestErrorRevisionConflict:
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}

func toolResultErrorStatus(err error) int {
	code, ok := frontendtools.InvocationErrorCodeOf(err)
	if !ok {
		return http.StatusInternalServerError
	}
	switch code {
	case frontendtools.InvocationErrorInvalidStatus, frontendtools.InvocationErrorExecutorMissing:
		return http.StatusBadRequest
	case frontendtools.InvocationErrorUnknownResult:
		return http.StatusNotFound
	case frontendtools.InvocationErrorLateResult:
		return http.StatusGone
	case frontendtools.InvocationErrorDuplicatePending,
		frontendtools.InvocationErrorSessionMismatch,
		frontendtools.InvocationErrorToolMismatch,
		frontendtools.InvocationErrorTerminalConflict,
		frontendtools.InvocationErrorKeyReuse,
		frontendtools.InvocationErrorExecutorMismatch,
		frontendtools.InvocationErrorExecutorUnavailable:
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}

func (executor frontendToolExecutor) toProto() *toolv1.FrontendToolExecutor {
	return &toolv1.FrontendToolExecutor{
		ClientInstanceId: strings.TrimSpace(executor.ClientInstanceID),
		ConnectionId:     strings.TrimSpace(executor.ConnectionID),
		AssignmentId:     strings.TrimSpace(executor.AssignmentID),
	}
}

func frontendToolExecutorFromProto(executor *toolv1.FrontendToolExecutor) frontendToolExecutor {
	return frontendToolExecutor{
		ClientInstanceID: executor.GetClientInstanceId(),
		ConnectionID:     executor.GetConnectionId(),
		AssignmentID:     executor.GetAssignmentId(),
	}
}

// HandleVerbPerformed records a verb the browser performed.
func (s *Server) HandleVerbPerformed(w http.ResponseWriter, r *http.Request) {
	sid := sessionIDFrom(r)
	if sid == "" {
		writeError(w, http.StatusBadRequest, "missing session id")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	cmd, err := pbuichat.VerbCommandFromJSON(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.hub.Submit(r.Context(), sid, pbuichat.CommandVerbPerformed, cmd); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, acceptedResponse{SessionID: string(sid), Accepted: true, Status: "recorded"})
}

// HandleEffectPerformed records one canonical agent effect outcome.
func (s *Server) HandleEffectPerformed(w http.ResponseWriter, r *http.Request) {
	sid := sessionIDFrom(r)
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	cmd, err := pbuichat.EffectCommandFromJSON(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if cmd.GetEffect().GetConversationId() != string(sid) {
		writeError(w, http.StatusBadRequest, "effect conversation does not match session")
		return
	}
	if err := s.hub.Submit(r.Context(), sid, pbuichat.CommandEffectPerformed, cmd); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, acceptedResponse{SessionID: string(sid), Accepted: true, Status: "effect_recorded"})
}

// HandleWS upgrades to the sessionstream websocket transport.
func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	s.ws.ServeHTTP(w, r)
}

func parseToolMode(mode string) toolv1.ToolExecutionMode {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "human", "frontend_human":
		return toolv1.ToolExecutionMode_TOOL_EXECUTION_MODE_FRONTEND_HUMAN
	case "backend":
		return toolv1.ToolExecutionMode_TOOL_EXECUTION_MODE_BACKEND
	default:
		return toolv1.ToolExecutionMode_TOOL_EXECUTION_MODE_FRONTEND_AUTO
	}
}
