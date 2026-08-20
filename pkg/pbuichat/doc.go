// Package pbuichat makes an LLM chat agent speak PBUI: every structured thing
// the agent says is a presentation reference, every widget is a declarative
// document of PBUI components, every user action is a serialisable verb, and
// every performed verb is recorded in a trace both parties can read.
//
// The package is a pinocchio chatapp.ChatPlugin plus a small set of geppetto
// tools. It owns no transport and no storage: objects and widgets ride in
// pinocchio's widget-instance entity (widget_name "pbui.refs" / "pbui.widget"),
// and the single new wire type is the verb trace (proto/hyperslop/pbui/chat/v1).
//
// The design is recorded in
// ttmp/2026/08/20/PBUI-AGENT-1--pbui-native-chat-agent-with-custom-pbui-widgets.
package pbuichat
