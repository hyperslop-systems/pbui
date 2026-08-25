[![Next](next.gif)](climuser-134.htm) [![Prev](prev.gif)](climuser-132.htm) [![Up](up.gif)](climuser-131.htm) 
[![Top](top.gif)](climuser.htm) [![Contents](contents.gif)](climuser-2.htm#pgfId-134688) 
[![Index](index.gif)](climuser-353.htm)

### 8.2 Applicability of CLIM Presentation Translators

When CLIM is waiting for input (inside a with-input-context) it is responsible for determining what 
translators are applicable to which presentations in a given input context. This loop both provides feedback 
in the form of highlighting sensitive presentations and is responsible for calling the applicable translator 
when the user presses a pointer button.

with-input-context uses frame-find-innermost-applicable-presentation (via highlight-applicable-presentation) 
as its "input wait" handler, and frame-input-context-button-press-handler as its button press "event handler."

Given a presentation, an input context established by with-input-context, and a user gesture, translator 
matching proceeds as follows.

The set of candidate translators is initially those translators accessible in the command table in use by the 
current application. For more information, see [11.3, Command Objects](climuser-203.htm#56058).

A translator "matches" if all of the following are true. Note that these tests are performed in the order 
listed.

The presentation's type is presentation-subtypep of the translator's *from-presentation-type*, ignoring type 
parameters (for example, if *from-presentation-type* is number and the presentation's type is integer or 
float, or if *from-presentation-type* is (or integer string) and presentation's type is integer).

The translator's *to-presentation-type* is presentation-subtypep of the input context type, ignoring type 
parameters.

The translator's gesture either is t or is the same as the gesture that the user could perform with the 
current chord of modifier keys.

The presentation's object is presentation-typep of the translator's *from-presentation-type*, if the 
*from-presentation-type* has parameters. The translator's tester returned a non-nil value. If there is no 
tester, the translator behaves as though the tester always returns t.

If there are parameters in the input context type and the :tester-definitive option is not used in the 
translator, the value returned by the body of the translator must be presentation-typep of the input context 
type. In define-presentation-to-command-translator and define-presentation-action, the tester is always 
definitive.

The algorithm is somewhat more complicated in the case of nested presentations and nested input contexts. In 
this situation, the sensitive presentation is the smallest presentation that matches the innermost input 
context.

When there are several translators that match for the same gesture, the one with the highest :priority is 
chosen (see define-presentation-translator).

#### 8.2.1 Input Contexts in CLIM

#### 8.2.2 Nested Presentations in CLIM

---

*Common Lisp Interface Manager 2.0 User's Guide - 3 Mar 2015*

[![Next](next.gif)](climuser-134.htm) [![Prev](prev.gif)](climuser-132.htm) [![Up](up.gif)](climuser-131.htm) 
[![Top](top.gif)](climuser.htm) [![Contents](contents.gif)](climuser-2.htm#pgfId-134688) 
[![Index](index.gif)](climuser-353.htm)
