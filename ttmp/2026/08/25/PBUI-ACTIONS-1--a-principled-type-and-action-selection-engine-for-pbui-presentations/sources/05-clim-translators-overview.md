[![Next](next.gif)](climuser-128.htm) [![Prev](prev.gif)](climuser-126.htm) [![Up](up.gif)](climuser-126.htm) 
[![Top](top.gif)](climuser.htm) [![Contents](contents.gif)](climuser-2.htm) 
[![Index](index.gif)](climuser-348.htm)

### 8.1 Conceptual Overview of Presentation Translators

CLIM provides a mechanism for "translating" between presentation types. In other words, within an input 
context for type A, the translator mechanism allows a programmer to have presentations of some other type B 
treated as though they were objects of type A.

You can define *presentation translators* to make the user interface of your application more flexible. For 
example, suppose the input context is expecting a command. In this input context, all displayed commands are 
sensitive, so the user can point to one to execute it. However, suppose the user points to another kind of 
displayed object, such as a student. In the absence of a presentation translator, the student is not 
sensitive because only commands can be entered to this input context.

If you used a presentation translator that translates from students to commands, however, both students and 
commands would be sensitive. When the student is highlighted, the middle pointer button might execute the 
command show-transcript for that student.

A presentation translator defines how to translate from one presentation type to another. In the previous 
scenario, the input context is command. A user-defined presentation translator states how to translate from 
the student presentation type to the command presentation type.

The concept of translating from an arbitrary presentation type to a command is so useful that CLIM provides 
the special define-presentation-to-command-translator macro for this purpose. You can think of these 
presentation-to-command translators as a convenience for the users; users can select the command and give the 
argument at the same time.

Note that presentation-to-command translators make it easier to write applications that give a "direct 
manipulation" feel to the user.

A presentation that appears on the screen can be *sensitive*. This means that the presentation can be 
operated on directly by using the pointer. A sensitive presentation will be highlighted when the pointer is 
over it. (In rare cases, the highlighting of some sensitive presentations is turned off.)

Sensitivity is controlled by three factors:

Input context type--a presentation type describes the type of input currently being accepted.

Pointer location--the pointer is pointing at a presentation or a blank area on the screen.

Modifier keys (` CONTROL`, ` META`, and ` SHIFT`)--these keys expand the space of available gestures beyond 
what is available from the pointer buttons.

Presentation translators link these three factors.

A presentation translator specifies the conditions under which it is applicable, a description to be 
displayed, and what to do when it is invoked by clicking the pointer.

A presentation is sensitive (and highlighted) if there is at least one applicable translator that could be 
invoked by clicking a button with the pointer at its current location and the modifier keys in their current 
state. If there is no applicable translator, there is no sensitivity and no highlighting.

Each presentation translator has two associated presentation types, its *from-presentation-type* and 
*to-presentation-type*, which are the primary factors in its applicability. Since a presentation translator 
translates an output presentation into an input presentation, a presentation translator is applicable if the 
type of the presentation at the pointer "matches" the *from-presentation-type* and the input context type 
"matches" the *to-presentation-type*. (We define what "match" means in the next section.) Each presentation 
translator is attached to a particular pointer gesture, which is a combination of a pointer button and a set 
of modifier keys. Clicking the pointer button while holding down the modifier keys invokes the translator.

Note that a translator produces an input presentation consisting of an object and a presentation type to 
satisfy the program accepting input. The result of a translator might be returned from accept, or it might be 
absorbed by a parser and provide only part of the input. An input presentation is not actually represented as 
an object. Instead, a translator's body returns two values. The object is the first value. The presentation 
type is the second value; it defaults to the *to-presentation-type* if the body returns only one value.

---

Common Lisp Interface Manager 2.0 User's Guide - 22 Dec 2009

[![Next](next.gif)](climuser-128.htm) [![Prev](prev.gif)](climuser-126.htm) [![Up](up.gif)](climuser-126.htm) 
[![Top](top.gif)](climuser.htm) [![Contents](contents.gif)](climuser-2.htm) 
[![Index](index.gif)](climuser-348.htm)
