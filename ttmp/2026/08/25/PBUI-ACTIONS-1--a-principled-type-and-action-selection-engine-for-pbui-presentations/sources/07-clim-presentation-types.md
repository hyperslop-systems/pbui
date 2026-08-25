### 23.3 Presentation Types

- [23.3.1 Defining Presentation Types](23-3.html#_1148)
- [23.3.2 Presentation Type Abbreviations](23-3.html#_1150)
- [23.3.3 Presentation Methods](23-3.html#_1155)
- [23.3.4 Presentation Type Functions](23-3.html#_1173)

The type associated with a presentation is specified with a presentation type specifier, an object matching 
one of the following three patterns:  

<table><tbody><tr><td align="LEFT" colspan="1"><i>name</i></td></tr><tr><td align="LEFT" 
colspan="1"><b>(</b><b><i>name</i></b> <b><i>parameters...</i></b><b>)</b></td></tr><tr><td align="LEFT" 
colspan="1"><b>((</b><b><i>name</i></b> <b><i>parameters...</i></b><b>) 
</b><b><i>options...</i></b><b>)</b></td></tr></tbody></table>

[\[annotate\]](edit/anno?aid=E7D381DEBCC7E11D7EB5B2C88FA6672F%2F23.3#Z)

[\[presentation type specifier, *Concept* ← 23.3.4 Presentation Type Functions, 
****presentation-type-direct-supertypes****\]](23-3.html#_4867)  
[\[presentation type specifier, *Concept* ← 23.3.4 Presentation Type Functions, 
****map-over-presentation-type-supertypes****\]](23-3.html#_4866)  
[\[presentation type specifier, *Concept* ← 23.3.4 Presentation Type Functions, 
****presentation-subtypep****\]](23-3.html#_4858)  
[\[presentation type specifier, *Concept* ← 23.3.4 Presentation Type Functions, 
****presentation-subtypep****\]](23-3.html#_4857)  
[\[presentation type specifier, *Concept* ← 23.3.4 Presentation Type Functions, 
****presentation-typep****\]](23-3.html#_4849)  
[\[presentation type specifier, *Concept* ← 23.3.4 Presentation Type Functions, 
****presentation-type-specifier-p****\]](23-3.html#_4846)  
[\[presentation type specifier, *Concept* ← 23.3.4 Presentation Type Functions, 
****describe-presentation-type****\]](23-3.html#_4833)  
[\[presentation type specifier, *Concept* ← 23.3.2 Presentation Type Abbreviations, 
****expand-presentation-type-abbreviation-1****\]](23-3.html#_4707)  

Note that *name* can be either a symbol that names a presentation type or a CLOS class object (but not a 
**built-in-class** object), in order to support anonymous CLOS classes. 
[\[annotate\]](edit/anno?aid=0987F8A5277CF73D37CBD16ACCF9AC03%2F23.3#Z)

The *parameters* "parameterize" the type, just as in a Common Lisp type specifier. The function 
[**presentation-typep**](23-3.html#_1182) uses the parameters to check object membership in a type. Adding 
parameters to a presentation type specifier produces a subtype, which contains some, but not necessarily all, 
of the objects that are members of the unparameterized type. Thus the parameters can turn off the sensitivity 
of some presentations that would otherwise be sensitive. 
[\[annotate\]](edit/anno?aid=30B86EBC72FB8351CA3C8EC7233E8573%2F23.3#Z)

The *options* are alternating keywords and values that affect the use or appearance of the presentation, but 
not its semantic meaning. The *options* have no effect on presentation sensitivity. (A programmer could 
choose to make a tester in a translator examine options, but this is not standard practice.) The standard 
option **:description** is accepted by all types; if it is a non- [**nil**](23-8.html#_1254) value, then the 
value must be a string that describes the type and overrides the description supplied by the type's 
definition. [\[annotate\]](edit/anno?aid=1B3742E8628E22C0BC836735D9E1D49F%2F23.3#Z)

Every presentation type is associated with a CLOS class. If *name* is a class object or the name of a class, 
and that class is not a **built-in-class**, that class is the associated class. Otherwise, 
[**define-presentation-type**](23-3.html#_1149) defines a class with metaclass **presentation-type-class** 
and superclasses determined by the presentation type definition. This class is not named *name*, since that 
could interfere with built-in Common Lisp types such as [**and**](23-8.html#_1288), 
[**member**](23-8.html#_1276), and [**integer**](23-8.html#_1266). **class-name** of this class returns a 
list **(presentation-type** ***name*****)**. **presentation-type-class** is a subclass of **standard-class**. 
[\[annotate\]](edit/anno?aid=02DDC50CA2D091DC9C19E6633AFE55AB%2F23.3#Z)

Implementations are permitted to require programmers to evaluate the **defclass** form first in the case when 
the same name is used in both a **defclass** and a [**define-presentation-type**](23-3.html#_1149). 
[\[annotate\]](edit/anno?aid=DC09119627C59838981C355031DAA937%2F23.3#Z)

Every CLOS class (except for built-in classes) is a presentation type, as is its name. If it has not been 
defined with [**define-presentation-type**](23-3.html#_1149), it allows no parameters and no options. 
[\[annotate\]](edit/anno?aid=CC956D5F6E940642611989BC52759724%2F23.3#Z)

Presentation type inheritance is used both to inherit methods ("what parser should be used for this type?"), 
and to establish the semantics for the type ("what objects are sensitive in this input context?"). 
Inheritance of methods is the same as in CLOS and thus depends only on the type name, not on the parameters 
and options. [\[annotate\]](edit/anno?aid=2400E0E63C0B2B5E56E35C2978E22BB1%2F23.3#Z)

During presentation method combination, presentation type inheritance arranges to translate the parameters of 
a subtype into a new set of parameters for its supertype, and translates the options of the subtype into a 
new set of options for the supertype. [\[annotate\]](edit/anno?aid=AE04DBC24A32471C8A68D2280D864330%2F23.3#Z)

#### 23.3.1 Defining Presentation Types

| **define-presentation-type** | *name parameters* *&key* *options inherit-from description history 
parameters-are-types* | \[Macro\] |
| --- | --- | --- |

|  | Defines a presentation type whose name is the symbol or class *name* and whose parameters are specified 
by the lambda-list *parameters*. These parameters are visible within *inherit-from* and within the methods 
created with [**define-presentation-method**](23-3.html#_1157). For example, the parameters are used by 
[**presentation-typep**](23-3.html#_1182) and [**presentation-subtypep**](23-3.html#_1184) methods to refine 
their tests for type inclusion. 
[\[annotate\]](edit/anno?aid=740609DCDA2EA1E9C84AF64B3049248A%2Fdefine-presentation-type%2F23.3.1#Z)  
*options* is a list of option specifiers. It defaults to [**nil**](23-8.html#_1254). An option specifier is 
either a symbol or a list (*symbol* &optional *default* *supplied-p* *presentation-type* *accept-options*), 
where *symbol*, *default*, and *supplied-p* are as in a normal lambda-list. If *presentation-type* and 
*accept-options* are present, they specify how to accept a new value for this option from the user. *symbol* 
can also be specified in the (*keyword* *variable*) form allowed for Common Lisp lambda lists. *symbol* is a 
variable that is visible within *inherit-from* and within most of the methods created with 
[**define-presentation-method**](23-3.html#_1157). The keyword corresponding to *symbol* can be used as an 
option in the third form of a presentation type specifier. An option specifier for the standard option 
**:description** is automatically added to *options* if an option with that keyword is not present, however 
it does not produce a visible variable binding. 
[\[annotate\]](edit/anno?aid=4C7EC683755D83B9A264D01F8CCED843%2Fdefine-presentation-type%2F23.3.1#Z)  
Unsupplied optional or keyword parameters default to **\*** (as in **deftype**) if no default is specified in 
*parameters*. Unsupplied options default to [**nil**](23-8.html#_1254) if no default is specified in 
*options*. 
[\[annotate\]](edit/anno?aid=6BE75233B78F0A3DC4B6F7A43E1BC59B%2Fdefine-presentation-type%2F23.3.1#Z)  
*inherit-from* is a form that evaluates to a presentation type specifier for another type from which the new 
type inherits. *inherit-from* can access the parameter variables bound by the *parameters* lambda list and 
the option variables specified by *options*. If *name* is or names a CLOS class (other than a 
**built-in-class**), then *inherit-from* must specify the class's direct superclasses (using 
[**and**](23-8.html#_1288) to specify multiple inheritance). It is useful to do this when you want to 
parameterize previously defined CLOS classes. 
[\[annotate\]](edit/anno?aid=E6B4FC588ECA37A868F5F06F727E194F%2Fdefine-presentation-type%2F23.3.1#Z)  If 
*inherit-from* is unsupplied, it defaults as follows: If *name* is or names a CLOS class, then the type 
inherits from the presentation type corresponding to the direct superclasses of that CLOS class (using 
[**and**](23-8.html#_1288) to specify multiple inheritance). Otherwise, the type named by *name* inherits 
from **standard-object**. 
[\[annotate\]](edit/anno?aid=38B4F911141A67739259C6C9ABBAE3DA%2Fdefine-presentation-type%2F23.3.1#Z)  
*description* is a string or [**nil**](23-8.html#_1254). This should be the term for an instance for the type 
being defined. If it is [**nil**](23-8.html#_1254) or unsupplied, a description is automatically generated; 
it will be a "prettied up" version of the type name, for example, **small-integer** would become **"small 
integer"**. You can also write a [**describe-presentation-type**](23-3.html#_1174) presentation method. 
*description* is implemented by the default [**describe-presentation-type**](23-3.html#_1174) method, so 
*description* only works in presentation types where that default method is not shadowed. 
[\[annotate\]](edit/anno?aid=194E42277355720A35AE0082AA8191DB%2Fdefine-presentation-type%2F23.3.1#Z)  
*history* can be [**t**](23-8.html#_1253) (the default), which means this type has its own history of 
previous inputs, [**nil**](23-8.html#_1254), which means this type keeps no history, or the name of another 
presentation type, whose history is shared by this type. More complex histories can be specified by writing a 
[**presentation-type-history**](23-3.html#_1169) presentation method. 
[\[annotate\]](edit/anno?aid=02FA6EE14A4F8B1DB906A52B6807A665%2Fdefine-presentation-type%2F23.3.1#Z)  **Minor 
issue:** *What is a presentation type history? Should they be exposed? --- SWM* 
[\[annotate\]](edit/anno?aid=2B5E68A897A15EAD9EDF6EAA3CBFEF75%2Fdefine-presentation-type%2F23.3.1#Z)  If the 
boolean *parameters-are-types* is true, this means that the parameters to the presentation type are 
themselves presentation types. If they are not presentation types, *parameters-are-types* should be supplied 
as false. Types such as [**and**](23-8.html#_1288), [**or**](23-8.html#_1287), and 
[**sequence**](23-8.html#_1284) will specify this as true. 
[\[annotate\]](edit/anno?aid=EE5075D8A80C74FB512F267EC4933309%2Fdefine-presentation-type%2F23.3.1#Z)  Every 
presentation type must define or inherit presentation methods for [**accept**](23-5.html#_1202) and 
[**present**](23-4.html#_1193) if the type is going to be used for input and output. For presentation types 
that are only going to be used for input via the pointer, the [**accept**](23-5.html#_1202) need not be 
defined. [\[annotate\]](edit/anno?aid=81CCC189966F11DB45B9497AD42A4FA1%2Fdefine-presentation-type%2F23.3.1#Z) 
 If a presentation type has *parameters*, it must define presentation methods for 
[**presentation-typep**](23-3.html#_1182) and [**presentation-subtypep**](23-3.html#_1184) that handle the 
parameters, or inherit appropriate presentation methods. In many cases it should also define presentation 
methods for [**describe-presentation-type**](23-3.html#_1174) and 
[**presentation-type-specifier-p**](23-3.html#_1181). 
[\[annotate\]](edit/anno?aid=39EBF722BBB3168D6D06169BCCC8C44B%2Fdefine-presentation-type%2F23.3.1#Z)  There 
are certain restrictions on the *inherit-from* form, to allow it to be analyzed at compile time. The form 
must be a simple substitution of parameters and options into positions in a fixed framework. It cannot 
involve conditionals or computations that depend on valid values for the parameters or options; for example, 
it cannot require parameter values to be numbers. It cannot depend on the dynamic or lexical environment. The 
form will be evaluated at compile time with uninterned symbols used as dummy values for the parameters and 
options. In the type specifier produced by evaluating the form, the type name must be a constant that names a 
type, the type parameters cannot derive from options of the type being defined, and the type options cannot 
derive from parameters of the type being defined. All presentation types mentioned must be already defined. 
[**and**](23-8.html#_1288) can be used for multiple inheritance, but [**or**](23-8.html#_1287), **not**, and 
**satisfies** cannot be used. 
[\[annotate\]](edit/anno?aid=0521946A6625BC2053926D8C545E8026%2Fdefine-presentation-type%2F23.3.1#Z)  None of 
the arguments, except *inherit-from*, is evaluated. 
[\[annotate\]](edit/anno?aid=0823EC51666F27A3492FA619BB5D0503%2Fdefine-presentation-type%2F23.3.1#Z)  
[\[annotate\]](edit/anno?aid=8F35F04CE19B31E9A4F6BDCF8C544446%2Fdefine-presentation-type%2F23.3.1#Z)  [\[← 
23.3.4 Presentation Type Functions, ****default-describe-presentation-type****\]](23-3.html#_4875)   [\[← 
23.3.2 Presentation Type Abbreviations, ****define-presentation-type-abbreviation****\]](23-3.html#_4702)   
[\[← 23.3 Presentation Types\]](23-3.html#_4648) |
| --- | --- |

#### 23.3.2 Presentation Type Abbreviations

| **define-presentation-type-abbreviation** | *name parameters equivalent-type* *&key* *options* | \[Macro\] |
| --- | --- | --- |

|  | *name*, *parameters*, and *options* are as in [**define-presentation-type**](23-3.html#_1149). This 
defines a presentation type that is an abbreviation for the presentation type *equivalent-type*. Presentation 
type abbreviations can only be used in places where this specification explicitly permits them. In such 
places, *equivalent-type* and [abbreviation](23-3.html#_1152) are exactly equivalent and can be used 
interchangeably. 
[\[annotate\]](edit/anno?aid=5EC57948766E3D3EACA33DEBC674009F%2Fdefine-presentation-type-abbreviation%2F23.3.2
#Z)  [\[abbreviation, *Concept* ← 23.3.2 Presentation Type Abbreviations, 
****define-presentation-type-abbreviation****\]](23-3.html#_4703)    *name* must be a symbol and must not be 
the name of a CLOS class. 
[\[annotate\]](edit/anno?aid=53AD7B32584EDAC7F2B931E394830E58%2Fdefine-presentation-type-abbreviation%2F23.3.2
#Z)  The *equivalent-type* form might be evaluated at compile time if presentation type abbreviations are 
expanded by compiler optimizers. Unlike *inherit-from*, *equivalent-type* can perform arbitrary computations 
and is not called with dummy parameter and option values. The type specifier produced by evaluating 
*equivalent-type* can be a real presentation type or another abbreviation. If the type specifier doesn't 
include the standard option **:description**, the option is automatically copied from the abbreviation to its 
expansion. 
[\[annotate\]](edit/anno?aid=3675131CC4AA890C5A13C09811D1177A%2Fdefine-presentation-type-abbreviation%2F23.3.2
#Z)  Note that you cannot define any presentation methods on a presentation type abbreviation. If you need 
methods, use [**define-presentation-type**](23-3.html#_1149) instead. 
[\[annotate\]](edit/anno?aid=257B9818D8E4F1F93FE77BF54581F78D%2Fdefine-presentation-type-abbreviation%2F23.3.2
#Z)  **define-presentation-type-abbreviation** is used to name a commonly used cliche. For example, a 
presentation type to read an octal integer might be defined as 
[\[annotate\]](edit/anno?aid=F4EEDA54201E7026A10C9330E90DB204%2Fdefine-presentation-type-abbreviation%2F23.3.2
#Z)  ``` (define-presentation-type-abbreviation octal-integer (&optional low high)      \`((integer ,low 
,high) :base 8 :description "octal integer")) ```  None of the arguments, except *equivalent-type*, is 
evaluated. 
[\[annotate\]](edit/anno?aid=027FC2D5018168324C2D0DFE42DCAE59%2Fdefine-presentation-type-abbreviation%2F23.3.2
#Z)  
[\[annotate\]](edit/anno?aid=0FFE273A3E457BA682A1BAC63AE91BB3%2Fdefine-presentation-type-abbreviation%2F23.3.2
#Z) |
| --- | --- |

| **expand-presentation-type-abbreviation-1** | *type* *&optional* *env* | \[Function\] |
| --- | --- | --- |

|  | If the [presentation type specifier](23-3.html#_1146) *type* is a presentation type abbreviation, or is 
an [**and**](23-8.html#_1288), [**or**](23-8.html#_1287), [**sequence**](23-8.html#_1284), or 
[**sequence-enumerated**](23-8.html#_1285) that contains a presentation type abbreviation, then this expands 
the type abbreviation once, and returns two values, the expansion and [**t**](23-8.html#_1253). If *type* is 
not a presentation type abbreviation, then the values *type* and [**nil**](23-8.html#_1254) are returned. 
[\[annotate\]](edit/anno?aid=E68E502FCDB9C07020EE1F5EF2E12958%2Fexpand-presentation-type-abbreviation-1%2F23.3
.2#Z)  *env* is a macro-expansion environment, as for **macroexpand**. 
[\[annotate\]](edit/anno?aid=DCE0786EE412A3AEB0B6DD8BEC6CA2ED%2Fexpand-presentation-type-abbreviation-1%2F23.3
.2#Z)  
[\[annotate\]](edit/anno?aid=60F28F3D918D75AB439C3515F1BBC2FD%2Fexpand-presentation-type-abbreviation-1%2F23.3
.2#Z)  [\[← 23.3.2 Presentation Type Abbreviations, 
****expand-presentation-type-abbreviation****\]](23-3.html#_4716) |
| --- | --- |

| **expand-presentation-type-abbreviation** | *type* *&optional* *env* | \[Function\] |
| --- | --- | --- |

|  | **expand-presentation-type-abbreviation** is like 
[**expand-presentation-type-abbreviation-1**](23-3.html#_1153), except that *type* is repeatedly expanded 
until all presentation type abbreviations have been removed. 
[\[annotate\]](edit/anno?aid=E85EFF684F31EA479EA23B763E616799%2Fexpand-presentation-type-abbreviation%2F23.3.2
#Z)  
[\[annotate\]](edit/anno?aid=2138808D0096016DC4F009AD3CB5A50F%2Fexpand-presentation-type-abbreviation%2F23.3.2
#Z) |
| --- | --- |

#### 23.3.3 Presentation Methods

Presentation methods inherit and combine in the same way as ordinary CLOS methods. The reason presentation 
methods are not exactly the same as ordinary CLOS methods revolves around the *type* argument. The parameter 
specializer for *type* is handled in a special way, and presentation method inheritance "massages" the type 
parameters and options seen by each method. For example, consider three types **int**, **rrat**, and **num** 
defined as follows: [\[annotate\]](edit/anno?aid=C74FD599C84FACBA8AE94285E538C272%2F23.3.3#Z)

**Minor issue:** *How are massaged arguments passed along? Right now, we pass along those parameters of the 
same name, and no others. --- SWM* [\[annotate\]](edit/anno?aid=F1099DB8FE1CE70443D243010E9E5406%2F23.3.3#Z)

```
(define-presentation-type int (low high)
  :inherit-from \`(rrat ,high ,low))

(define-presentation-method presentation-typep :around (object (type int))
  (and (call-next-method)
       (integerp object)
       (<= low object high)))

(define-presentation-type rrat (high low)
  :inherit-from \`num)

(define-presentation-method presentation-typep :around (object (type rrat))
  (and (call-next-method)
       (rationalp object)
       (<= low object high)))

(define-presentation-type num ())

(define-presentation-method presentation-typep (object (type num))
  (numberp object))
```

If the user were to evaluate the form **(presentation-typep X '(int 1 5))**, then the type parameters will be 
**(1 5)** in the [**presentation-typep**](23-3.html#_1182) method for **int**, **(5 1)** in the method for 
**rrat**, and [**nil**](23-8.html#_1254) in the method for **num**. The value for *type* will be or **((int 1 
5))** in each of the methods. [\[annotate\]](edit/anno?aid=731CE1061057AF37A58730E2602835D9%2F23.3.3#Z)

| **define-presentation-generic-function** | *generic-function-name presentation-function-name lambda-list* 
*&rest* *options* | \[Macro\] |
| --- | --- | --- |

|  | Defines a generic function that will be used for presentation methods. *generic-function-name* is a 
symbol that names the generic function that will be used internally by CLIM for the individual methods, 
*presentation-function-name* is a symbol that names the function that programmers will call to invoke the 
method, and *lambda-list* and *options* are as for **defgeneric**. 
[\[annotate\]](edit/anno?aid=C4450F34B3897B5A59F9487301B20B2C%2Fdefine-presentation-generic-function%2F23.3.3#
Z)  There are some "special" arguments in *lambda-list* that are known about by the presentation type system. 
The first argument in *lambda-list* must be either **type-key** or **type-class**; this argument is used by 
CLIM to implement method dispatching. The second argument may be **parameters**, meaning that, when the 
method is invoked, the type parameters will be passed to it. The third argument may be **options**, meaning 
that, when the method is invoked, the type options will be passed to it. Finally, an argument named **type** 
must be included in *lambda-list*; when the method is called, *type* argument will be bound to the 
presentation type specifier. 
[\[annotate\]](edit/anno?aid=955443B38B9F06BA950928315328A72D%2Fdefine-presentation-generic-function%2F23.3.3#
Z)  *Note:*  It is open how [type-key](edit/apropos?q=type-key), [type-class](edit/apropos?q=type-class), 
[parameters](edit/apropos?q=parameters), [options](edit/apropos?q=options) and [type](edit/apropos?q=type) 
are to be matched. I see two options:  1\. Use the [string=](edit/apropos?q=string%3D) like matching. That is 
don't take the package into account.  2\. Use [eq](edit/apropos?q=eq) but then export the relevant symbols 
from the [clim](edit/apropos?q=clim) package. Because otherwise the user who wants to define a presentation 
generic function is forced to tamper with [clim-internals](edit/apropos?q=clim-internals).  In McCLIM of 
today option 2 is used but the exporting.  
[\[edit\]](edit/anno?aid=955443B38B9F06BA950928315328A72D%2Fdefine-presentation-generic-function%2F23.3.3&edit
p=t&id=Z69#Z69) *\-- Gilbert Baumann 2004-06-12 17:11Z*  For example, the [**accept**](23-5.html#_1202) 
presentation generic function might be defined as follows: 
[\[annotate\]](edit/anno?aid=555BF559D4D727B5CAA0D6CBE3B453F7%2Fdefine-presentation-generic-function%2F23.3.3#
Z)  *Note:* Typo - they must have meant the PRESENT method. 
[\[edit\]](edit/anno?aid=555BF559D4D727B5CAA0D6CBE3B453F7%2Fdefine-presentation-generic-function%2F23.3.3&edit
p=t&id=Z60#Z60) *\-- Andy Hefner 2003-07-09 00:29Z*  ``` (define-presentation-generic-function present-method 
present   (type-key parameters options object type stream view    &key acceptably for-context-type)) ```  
None of the arguments is evaluated. 
[\[annotate\]](edit/anno?aid=76ED0411832BC3248FF623904D7C4C42%2Fdefine-presentation-generic-function%2F23.3.3#
Z)  
[\[annotate\]](edit/anno?aid=2542D9E066CEC3AFFE098BD60B86086B%2Fdefine-presentation-generic-function%2F23.3.3#
Z)  [\[← 23.3.3 Presentation Methods, ****funcall-presentation-generic-function****\]](23-3.html#_4748) |
| --- | --- |

| **define-presentation-method** | *name qualifiers\* specialized-lambda-list* *&body* *body* | \[Macro\] |
| --- | --- | --- |

|  | Defines a presentation method for the function named *name* on the presentation type named in 
*specialized-lambda-list*. *specialized-lambda-list* is a CLOS specialized lambda list for the method, and 
its contents varies depending on what *name* is. *qualifiers\** is zero or more of the usual CLOS method 
qualifier symbols. **define-presentation-method** must support at least **standard** method combination (and 
therefore the **:before**, **:after**, and **:around** method qualifiers). Some CLIM implementations may 
support other method combination types, but this is not required. 
[\[annotate\]](edit/anno?aid=207E720DB1CD36D3825CA7C0532EE6B4%2Fdefine-presentation-method%2F23.3.3#Z)  
*body* defines the body of the method. *body* may have zero or more declarations as its first forms. 
[\[annotate\]](edit/anno?aid=868CE1D844EFBD1865AFB87CF094023B%2Fdefine-presentation-method%2F23.3.3#Z)  All 
presentation methods have an argument named *type* that must be specialized with the name of a presentation 
type. The value of *type* is a presentation type specifier, which can be for a subtype that inherited the 
method. 
[\[annotate\]](edit/anno?aid=8634B53996B24674DFBD088F54B4609B%2Fdefine-presentation-method%2F23.3.3#Z)  All 
presentation methods except [**presentation-subtypep**](23-3.html#_1184) have lexical access to the 
parameters from the presentation type specifier. Presentation methods for the functions 
[**accept**](23-5.html#_1202), [**present**](23-4.html#_1193), 
[**describe-presentation-type**](23-3.html#_1174), [**presentation-type-specifier-p**](23-3.html#_1181), and 
[**accept-present-default**](23-3.html#_1168) also have lexical access to the options from the presentation 
type specifier. 
[\[annotate\]](edit/anno?aid=69E9075ED1252C243103FD5800D8E170%2Fdefine-presentation-method%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=E9A6179BF634CAF45EA50023F9E0B74A%2Fdefine-presentation-method%2F23.3.3#Z)  
[\[← 23.3.3 Presentation Methods, ****define-default-presentation-method****\]](23-3.html#_4747)   [\[← 
23.3.1 Defining Presentation Types, ****define-presentation-type****\]](23-3.html#_4663) |
| --- | --- |

| **define-default-presentation-method** | *name qualifiers\* specialized-lambda-list* *&body* *body* | 
\[Macro\] |
| --- | --- | --- |

|  | Like [**define-presentation-method**](23-3.html#_1157), except that it is used to define a default 
method that will be used only if there are no more specific methods. 
[\[annotate\]](edit/anno?aid=E55AC06726007ADE1D544DC60A5013B9%2Fdefine-default-presentation-method%2F23.3.3#Z)
  
[\[annotate\]](edit/anno?aid=6F2B6998C5D233A5342FDF71D321F057%2Fdefine-default-presentation-method%2F23.3.3#Z)
 |
| --- | --- |

| **funcall-presentation-generic-function** | *presentation-function-name* *&rest* *arguments* | \[Macro\] |
| --- | --- | --- |

|  | Calls the presentation generic function named by *presentation-function-name* on the arguments 
*arguments*. *arguments* must match the arguments specified by the 
[**define-presentation-generic-function**](23-3.html#_1156) that was used to define the presentation generic 
function, excluding the **type-key**, **type-class**, **parameters**, and **options** arguments, which are 
filled in by CLIM. 
[\[annotate\]](edit/anno?aid=BDD21F8E98692F4BDDDF28C7342E34B7%2Ffuncall-presentation-generic-function%2F23.3.3
#Z)  **funcall-presentation-generic-function** is analogous to **funcall**. 
[\[annotate\]](edit/anno?aid=D6951B49372F51FC95EC3E9C1BFD13B9%2Ffuncall-presentation-generic-function%2F23.3.3
#Z)  The *presentation-function-name* argument is not evaluated. 
[\[annotate\]](edit/anno?aid=3720A3211C573B4941401E169E5BEAC8%2Ffuncall-presentation-generic-function%2F23.3.3
#Z)  For example, to call the [**present**](23-4.html#_1193) presentation generic function, one might use the 
following: 
[\[annotate\]](edit/anno?aid=CAE67B35EE58769CD154EF515DC71474%2Ffuncall-presentation-generic-function%2F23.3.3
#Z)  ``` (funcall-presentation-generic-function present   object presentation-type stream view) ```  
[\[annotate\]](edit/anno?aid=8E6EA8809A606894E80DFEA66B37EBEA%2Ffuncall-presentation-generic-function%2F23.3.3
#Z)  [\[← 23.3.3 Presentation Methods, ****apply-presentation-generic-function****\]](23-3.html#_4756) |
| --- | --- |

| **apply-presentation-generic-function** | *presentation-function-name* *&rest* *arguments* | \[Macro\] |
| --- | --- | --- |

|  | Like [**funcall-presentation-generic-function**](23-3.html#_1159), except that 
**apply-presentation-generic-function** is analogous to **apply**. 
[\[annotate\]](edit/anno?aid=6CE6141796F97F0B7C78735061BE36B5%2Fapply-presentation-generic-function%2F23.3.3#Z
)  The *presentation-function-name* argument is not evaluated. 
[\[annotate\]](edit/anno?aid=3720A3211C573B4941401E169E5BEAC8%2Fapply-presentation-generic-function%2F23.3.3#Z
)  Here is a list of all of the standard presentation methods and their specialized lambda lists. For the 
meaning of the arguments to each presentation method, refer to the description of the function that calls 
that method. 
[\[annotate\]](edit/anno?aid=1062F763D228EC974E0A8247BA340306%2Fapply-presentation-generic-function%2F23.3.3#Z
)  For all of the presentation methods, the *type* will always be specialized. For those methods that take a 
*view* argument, implementors and programmers may specialize it as well. The other arguments are not 
typically specialized. 
[\[annotate\]](edit/anno?aid=8FA332333FCFECB4EDA331868CE2BE21%2Fapply-presentation-generic-function%2F23.3.3#Z
)  
[\[annotate\]](edit/anno?aid=EF2E9AC205E1E220FE325010A64BA61F%2Fapply-presentation-generic-function%2F23.3.3#Z
) |
| --- | --- |

| **present** | *object type stream view* *&key* *acceptably for-context-type* | \[Presentation Method\] |
| --- | --- | --- |

|  | The **present** presentation method is responsible for displaying the representation of *object* having 
[presentation type](23-1.html#_1126) *type* for a particular view *view*. The method's caller takes care of 
creating the presentation, the method simply displays the content of the presentation. 
[\[annotate\]](edit/anno?aid=75089BB4E49AF179C44C16CA8D690D85%2Fpresent%2F23.3.3#Z)  The **present** method 
can specialize on the *view* argument in order to define more than one view of the data. For example, a 
spreadsheet program might define a presentation type for revenue, which can be displayed either as a number 
or a bar of a certain length in a bar graph. Typically, at least one canonical view should be defined for a 
presentation type, for example, the **present** method for the [**textual-view**](23-6.html#_1211) view must 
be defined if the programmer wants to allow objects of that type to be displayed textually. 
[\[annotate\]](edit/anno?aid=23324A31A1B8A0CF0DF29A7BB92D5B65%2Fpresent%2F23.3.3#Z)  **Implementation note:** 
the actual argument list to the **present** method is   *(type-key parameters options object type stream 
view* *&key* *acceptably for-context-type)*   *type-key* is the object that is used to cause the appropriate 
methods to be selected (an instance of the class that corresponds to the presentation type *type*.). 
*parameters* and *options* are the parameters and options for the type on which the current method is 
specialized. The other arguments are gotten from the arguments of the same name in **present**. 
[\[annotate\]](edit/anno?aid=E6DFA1A913D4DBDEB8BDBAFA7CAB2A7A%2Fpresent%2F23.3.3#Z)  **Implementation note:** 
the actual generic function of the **present** method is an internal generic function, not the function whose 
name is **present**. Similar internal generic functions are used for all presentation methods. 
[\[annotate\]](edit/anno?aid=56ACF0982BACF6BC83A3DF6A02E76F12%2Fpresent%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=2970CE298AA33020B71A8029ED924482%2Fpresent%2F23.3.3#Z)  [\[→ present, 
*Function*\]](23-4.html#_1193) |
| --- | --- |

| **accept** | *type stream view* *&key* *default default-type* | \[Presentation Method\] |
| --- | --- | --- |

|  | The **accept** method is responsible for "parsing" the representation of the [presentation 
type](23-1.html#_1126) *type* for a particular view *view*. The **accept** method must return a single value, 
the object that was "parsed", or two values, the object and its type (a presentation type specifier). The 
method's caller takes care of establishing the input context, defaulting, prompting, and input editing. 
[\[annotate\]](edit/anno?aid=15A367F751E92F7DA12D08F2C245DEC2%2Faccept%2F23.3.3#Z)  The **accept** method can 
specialize on the *view* argument in order to define more than one input view for the data. The **accept** 
method for the [**textual-view**](23-6.html#_1211) view must be defined if the programmer wants to allow 
objects of that type to entered via the keyboard. 
[\[annotate\]](edit/anno?aid=6BAB129C11A86E0688F235695936C931%2Faccept%2F23.3.3#Z)  Note that **accept** 
presentation methods can call **accept** recursively. In this case, the programmer should be careful to 
specify [**nil**](23-8.html#_1254) for **:prompt** and **:display-default** unless recursive prompting is 
really desired. [\[annotate\]](edit/anno?aid=F5741A128B1846E9983F2C20061C794C%2Faccept%2F23.3.3#Z)  
**Implementation note:** the actual argument list to the **accept** method is   *(type-key parameters options 
type stream view* *&key* *default default-type)* 
[\[annotate\]](edit/anno?aid=9DD605837EDD7B5CA3C96DB9321A0171%2Faccept%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=5ABB8A6448E07B3FC55A5D2EBE6E060A%2Faccept%2F23.3.3#Z)  [\[→ accept, 
*Function*\]](23-5.html#_1202)    [\[← F Changes from CLIM 1.0\]](F.html#_7454)   [\[← C Encapsulating 
Streams\]](C.html#_7092)   [\[← 27.6.1 Command Presentation Types, 
****command-or-form****\]](27-6.html#_6106)   [\[← 27.6.1 Command Presentation Types, 
****command****\]](27-6.html#_6084)   [\[← 27.6 The Command Processor, 
****read-command****\]](27-6.html#_6064)   [\[← 27.1 Commands, ****define-command****\]](27-1.html#_5816)   
[\[← 26 Dialog Facilities, ****accepting-values****\]](26.html#_5673)   [\[← 24.5 Completion, 
****with-accept-help****\]](24-5.html#_5579)   [\[← 24.5 Completion, 
****\*help-gestures\*****\]](24-5.html#_5507)   [\[← 24.2 Activation and Delimiter Gestures, 
****with-delimiter-gestures****\]](24-2.html#_5465)   [\[← 24.2 Activation and Delimiter Gestures, 
****with-activation-gestures****\]](24-2.html#_5453)   [\[← 24.2 Activation and Delimiter 
Gestures\]](24-2.html#_5442)   [\[← 24.1.1 The Input Editing Stream Protocol, 
****stream-scan-pointer****\]](24-1.html#_5409)   [\[← 24.1.1 The Input Editing Stream 
Protocol\]](24-1.html#_5396)   [\[← 24.1 The Input Editor, ****input-editor-format****\]](24-1.html#_5389)  
 [\[← 24.1 The Input Editor\]](24-1.html#_5349)   [\[← 23.8.8 Compound Presentation Types, 
****type-or-string****\]](23-8.html#_5340)   [\[← 23.8.7 "Meta" Presentation Types, 
****and****\]](23-8.html#_5335)   [\[← 23.8.7 "Meta" Presentation Types, ****or****\]](23-8.html#_5311)   
[\[← 23.8.6 Sequence Presentation Types, ****sequence-enumerated****\]](23-8.html#_5308)   [\[← 23.8.6 
Sequence Presentation Types, ****sequence****\]](23-8.html#_5302)   [\[← 23.8.5 "One-of" and "Some-of" 
Presentation Types, ****completion****\]](23-8.html#_5272)   [\[← 23.8.4 Pathname Presentation Type, 
****pathname****\]](23-8.html#_5265)   [\[← 23.7.1 Defining Presentation Translators, 
****define-presentation-translator****\]](23-7.html#_5117)   [\[← 23.6 Views, 
****stream-default-view****\]](23-6.html#_5084)   [\[← 23.6 Views\]](23-6.html#_5055)   [\[← 23.5 
Context-dependent (Typed) Input, ****prompt-for-accept-1****\]](23-5.html#_5049)   [\[← 23.5 
Context-dependent (Typed) Input, ****prompt-for-accept****\]](23-5.html#_5033)   [\[← 23.5 
Context-dependent (Typed) Input, ****accept-from-string****\]](23-5.html#_5029)   [\[← 23.5 
Context-dependent (Typed) Input, ****accept-1****\]](23-5.html#_4983)   [\[← 23.5 Context-dependent (Typed) 
Input, ****stream-accept****\]](23-5.html#_4960)   [\[← 23.4 Typed Output, 
****stream-present****\]](23-4.html#_4926)   [\[← 23.3.3 Presentation Methods, 
****accept-present-default****\]](23-3.html#_4810)   [\[← 23.3.3 Presentation Methods, 
****define-presentation-method****\]](23-3.html#_4742)   [\[← 23.3.3 Presentation Methods, 
****define-presentation-generic-function****\]](23-3.html#_4735)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4691)   [\[← 22.3.1 Standard Gesture 
Names\]](22-3.html#_4513) |
| --- | --- |

| **describe-presentation-type** | *type stream plural-count* | \[Presentation Method\] |
| --- | --- | --- |

|  | The **describe-presentation-type** method is responsible for textually describing the [presentation 
type](23-1.html#_1126) *type*. *stream* is a stream, and will not be [**nil**](23-8.html#_1254) as it can be 
for the **describe-presentation-type** function. 
[\[annotate\]](edit/anno?aid=A401C68D286B36D99DB968D7B2137563%2Fdescribe-presentation-type%2F23.3.3#Z)  
**Implementation note:** the actual argument list to the **describe-presentation-type** method is   
*(type-key parameters options type stream plural-count)* 
[\[annotate\]](edit/anno?aid=D5C5515839EB44FF09FE83DD5C109955%2Fdescribe-presentation-type%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=753B62B1F66F6699C11A1A5C80D4EC0A%2Fdescribe-presentation-type%2F23.3.3#Z)  
[\[→ describe-presentation-type, *Function*\]](23-3.html#_1174)    [\[← 23.5 Context-dependent (Typed) 
Input, ****prompt-for-accept-1****\]](23-5.html#_5048)   [\[← 23.3.4 Presentation Type Functions, 
****default-describe-presentation-type****\]](23-3.html#_4872)   [\[← 23.3.3 Presentation Methods, 
****accept-present-default****\]](23-3.html#_4814)   [\[← 23.3.3 Presentation Methods, 
****define-presentation-method****\]](23-3.html#_4744)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4680) |
| --- | --- |

| **presentation-type-specifier-p** | *type* | \[Presentation Method\] |
| --- | --- | --- |

|  | The **presentation-type-specifier-p** method is responsible for checking the validity of the parameters 
and options for the [presentation type](23-1.html#_1126) *type*. The default method returns 
[**t**](23-8.html#_1253). 
[\[annotate\]](edit/anno?aid=37FCFA369A609E846837190A96DB5113%2Fpresentation-type-specifier-p%2F23.3.3#Z)  
**Implementation note:** the actual argument list to the **presentation-type-specifier-p** method is   
*(type-key parameters options type)* 
[\[annotate\]](edit/anno?aid=FA42A3F3A638080449EDD6A64FDB9387%2Fpresentation-type-specifier-p%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=CD801C346756853016DE89F82ECA11F3%2Fpresentation-type-specifier-p%2F23.3.3#Z)  
[\[→ presentation-type-specifier-p, *Function*\]](23-3.html#_1181)    [\[← 23.3.3 Presentation Methods, 
****define-presentation-method****\]](23-3.html#_4745)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4697) |
| --- | --- |

| **presentation-typep** | *object type* | \[Presentation Method\] |
| --- | --- | --- |

|  | The **presentation-typep** method is called when the **presentation-typep** function requires 
type-specific knowledge. If the type name in the [presentation type](23-1.html#_1126) *type* is a CLOS class 
or names a CLOS class, the method is called only if *object* is a member of the class and *type* contains 
parameters, and the method simply tests whether *object* is a member of the subtype specified by the 
parameters. For non-class types, the method is always called. 
[\[annotate\]](edit/anno?aid=3919BE0D23EE49278D8E398991665F0B%2Fpresentation-typep%2F23.3.3#Z)  
**Implementation note:** the actual argument list to the **presentation-typep** method is   *(type-key 
parameters object type)* 
[\[annotate\]](edit/anno?aid=F8B3E1A1D1A3C4276BF55C06EA1310D0%2Fpresentation-typep%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=BB78C9990CC393B2AF3F6C94511F2B12%2Fpresentation-typep%2F23.3.3#Z)  [\[→ 
presentation-typep, *Function*\]](23-3.html#_1182)    [\[← 23.7.4 Translator 
Applicability\]](23-7.html#_5230)   [\[← 23.7.1 Defining Presentation Translators, 
****define-presentation-translator****\]](23-7.html#_5113)   [\[← 23.3.3 Presentation 
Methods\]](23-3.html#_4722)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4664)   [\[← 23.3 Presentation Types\]](23-3.html#_4644) |
| --- | --- |

| **presentation-subtypep** | *type putative-supertype* | \[Presentation Method\] |
| --- | --- | --- |

|  | **presentation-subtypep** walks the type lattice (using **map-over-presentation-supertypes**) to 
determine whethe or not the [presentation type](23-1.html#_1126) *type* is a subtype of the [presentation 
type](23-1.html#_1126) *putative-supertype*, without looking at the type parameters. When a supertype of 
*type* has been found whose name is the same as the name of *putative-supertype*, then the **subtypep** 
method for that type is called in order to resolve the question by looking at the type parameters (that is, 
if the **subtypep** method is called, *type* and *putative-supertype* are guaranteed to be the same type, 
differing only in their parameters). If *putative-supertype* is never found during the type walk, then 
**presentation-subtypep** will never call the **presentation-subtypep** presentation method for 
*putative-supertype*. 
[\[annotate\]](edit/anno?aid=4A657CBB2B915CD901CFF3DFB5220033%2Fpresentation-subtypep%2F23.3.3#Z)  Unlike all 
other presentation methods, **presentation-subtypep** receives a *type* argument that has been translated to 
the presentation type for which the method is specialized; *type* is never a subtype. The method is only 
called if *putative-supertype* has parameters and the two presentation type specifiers do not have equal 
parameters. The method must return the two values that **presentation-subtypep** returns. 
[\[annotate\]](edit/anno?aid=84B3CDF15956EE0AF2A22D81AF6270AD%2Fpresentation-subtypep%2F23.3.3#Z)  Since 
**presentation-subtypep** takes two type arguments, the parameters are not lexically available as variables 
in the body of a presentation method. 
[\[annotate\]](edit/anno?aid=669142513EFFA2CFE891B3AECD00E153%2Fpresentation-subtypep%2F23.3.3#Z)  
**Implementation note:** the actual argument list to the **presentation-subtypep** method is   *(type-key 
type putative-supertype)* 
[\[annotate\]](edit/anno?aid=3875A2F5EFDB96D5A2A39821B99624FC%2Fpresentation-subtypep%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=3690AB396C855D9F902ED648F26871D1%2Fpresentation-subtypep%2F23.3.3#Z)  [\[→ 
presentation-subtypep, *Function*\]](23-3.html#_1184)    [\[← 23.7.4 Translator 
Applicability\]](23-7.html#_5227)   [\[← 23.7.1 Defining Presentation Translators, 
****define-presentation-translator****\]](23-7.html#_5114)   [\[← 23.3.3 Presentation Methods, 
****define-presentation-method****\]](23-3.html#_4741)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4665) |
| --- | --- |

| **map-over-presentation-type-supertypes** | *function type* | \[Presentation Method\] |
| --- | --- | --- |

|  | This method is called in order to apply *function* to the superclasses of the [presentation 
type](23-1.html#_1126) *type*. 
[\[annotate\]](edit/anno?aid=8A686C914E554396FFDE96FBF32C4299%2Fmap-over-presentation-type-supertypes%2F23.3.3
#Z)  **Implementation note:** the actual argument list to the **map-over-presentation-type-supertypes** 
method is   *(type-class function type)* 
[\[annotate\]](edit/anno?aid=979E0DE47B5E3AB99274E87B089ABE32%2Fmap-over-presentation-type-supertypes%2F23.3.3
#Z)  
[\[annotate\]](edit/anno?aid=1176A0E8067B31C95894F53C66F238BA%2Fmap-over-presentation-type-supertypes%2F23.3.3
#Z)  [\[→ map-over-presentation-type-supertypes, *Function*\]](23-3.html#_1185) |
| --- | --- |

| **accept-present-default** | *type stream view default default-supplied-p present-p query-identifier* | 
\[Presentation Method\] |
| --- | --- | --- |

|  | The **accept-present-default** method is called when [**accept**](23-5.html#_1202) turns into 
[**present**](23-4.html#_1193) inside of [**accepting-values**](26.html#_1364). The default method calls 
[**present**](23-4.html#_1193) or [**describe-presentation-type**](23-3.html#_1174) depending on whether 
*default-supplied-p* is true or false, respectively. 
[\[annotate\]](edit/anno?aid=12FE6E50639525DCF6F3AB94CFDE65D5%2Faccept-present-default%2F23.3.3#Z)  The 
boolean *default-supplied-p* will be true only in the case when the **:default** option was explicitly 
supplied in the call to [**accept**](23-5.html#_1202) that invoked **accept-present-default**. 
[\[annotate\]](edit/anno?aid=726EC5623B19A303AD313E66BE883BC0%2Faccept-present-default%2F23.3.3#Z)  
**Implementation note:** the actual argument list to the **accept-present-default** method is   *(type-key 
parameters options type stream view default default-supplied-p present-p query-identifier)* 
[\[annotate\]](edit/anno?aid=1BE3F957AC3F19A74781653E89F4224F%2Faccept-present-default%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=B8980FDAB2C7E06E467C8C685E6EF706%2Faccept-present-default%2F23.3.3#Z)  [\[← 26 
Dialog Facilities, ****accepting-values****\]](26.html#_5684)   [\[← 23.3.3 Presentation Methods, 
****define-presentation-method****\]](23-3.html#_4746) |
| --- | --- |

| **presentation-type-history** | *type* | \[Presentation Method\] |
| --- | --- | --- |

|  | This method is responsible for returning a history object for the [presentation type](23-1.html#_1126) 
*type*. [\[annotate\]](edit/anno?aid=F60B4FEC672EBB4A2DAF094E8AEBE87E%2Fpresentation-type-history%2F23.3.3#Z) 
 *Note:* while discussing this on IRC, Andy Hefner and I came to the conclusion that the "history object" 
needs only be used in ACCEPT and similar methods and is therefore left not very specified. Is that correct? 
[\[edit\]](edit/anno?aid=F60B4FEC672EBB4A2DAF094E8AEBE87E%2Fpresentation-type-history%2F23.3.3&editp=t&id=Z53#
Z53) *\-- Andreas Fuchs 2003-06-09 18:49Z*  **Implementation note:** the actual argument list to the 
**presentation-type-history** method is   *(type-key parameters type)* 
[\[annotate\]](edit/anno?aid=16966E8D6261EA3390BAB6DDA0DAAABD%2Fpresentation-type-history%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=DAF54A9BE80DA7139FA7DF8CC67C3D79%2Fpresentation-type-history%2F23.3.3#Z)  [\[← 
23.3.1 Defining Presentation Types, ****define-presentation-type****\]](23-3.html#_4684) |
| --- | --- |

| **presentation-default-preprocessor** | *default type* *&key* *default-type* | \[Presentation Method\] |
| --- | --- | --- |

|  | This method is responsible for taking the object *default*, and coercing it to match the [presentation 
type](23-1.html#_1126) *type* (which is the type being accepted) and *default-type* (which is the 
presentation type of *default*). This is useful when you want to change the default gotten from the 
presentation type's history so that it conforms to parameters or options in *type* and *default-type*.) The 
method must return two values, the new object to be used as the default, and a new presentation type, which 
should be at least as specific as *type*. 
[\[annotate\]](edit/anno?aid=B3B6F41867D865E679232B2E1FD4756A%2Fpresentation-default-preprocessor%2F23.3.3#Z) 
 **Implementation note:** the actual argument list to the **presentation-default-preprocessor** method is   
*(type-key parameters default type* *&key* *default-type)* 
[\[annotate\]](edit/anno?aid=6F2ACAF4DEEA01868FD18C27E4B17477%2Fpresentation-default-preprocessor%2F23.3.3#Z) 
 
[\[annotate\]](edit/anno?aid=B947226A71E9605795546D9B9336665B%2Fpresentation-default-preprocessor%2F23.3.3#Z) 
|
| --- | --- |

| **presentation-refined-position-test** | *type record x y* | \[Presentation Method\] |
| --- | --- | --- |

|  | This method used to definitively answer hit detection queries for a presentation, that is, determining 
that the point *(x,y)* is contained within the output record *record*. Its contract is exactly the same as 
for [**output-record-refined-position-test**](16-2.html#_855), except that it is intended to specialize on 
the presentation type *type*. 
[\[annotate\]](edit/anno?aid=5B63576FB766F9B92A0894A8B78EE78C%2Fpresentation-refined-position-test%2F23.3.3#Z)
  **Implementation note:** the actual argument list to the **presentation-refined-position-test** method is   
*(type-key parameters options type record x y)* 
[\[annotate\]](edit/anno?aid=4B74E639109FBD4FAE2A344F6E575FBA%2Fpresentation-refined-position-test%2F23.3.3#Z)
  
[\[annotate\]](edit/anno?aid=39DC2F05EB7138483298AE546726722A%2Fpresentation-refined-position-test%2F23.3.3#Z)
 |
| --- | --- |

| **highlight-presentation** | *type record stream state* | \[Presentation Method\] |
| --- | --- | --- |

|  | This method is responsible for drawing a highlighting box around the [presentation](23-2.html#_1128) 
*record* on the output recording stream *stream*. *state* will be either **:highlight** or **:unhighlight**. 
[\[annotate\]](edit/anno?aid=15612339EFCC594F82FB4E86863DBA0D%2Fhighlight-presentation%2F23.3.3#Z)  
**Implementation note:** the actual argument list to the **highlight-presentation** method is   *(type-key 
parameters options type record stream state)* 
[\[annotate\]](edit/anno?aid=C713B52BC2A33745E46433486DFE04F2%2Fhighlight-presentation%2F23.3.3#Z)  
[\[annotate\]](edit/anno?aid=955B6E9D27FEBA99B99EC3F036167C61%2Fhighlight-presentation%2F23.3.3#Z)  [\[← 
23.7.3 Finding Applicable Presentations, ****set-highlighted-presentation****\]](23-7.html#_5218) |
| --- | --- |

#### 23.3.4 Presentation Type Functions

| **describe-presentation-type** | *type* *&optional* *stream plural-count* | \[Function\] |
| --- | --- | --- |

|  | Describes the [presentation type specifier](23-3.html#_1146) *type* on the stream *stream*, which 
defaults to **\*standard-output\***. If *stream* is [**nil**](23-8.html#_1254), a string containing the 
description is returned. *plural-count* is either [**nil**](23-8.html#_1254) (meaning that the description 
should be the singular form of the name), [**t**](23-8.html#_1253) (meaning that the description should the 
plural form of the name), or an integer greater than zero (the number of items to be described). The default 
is **1**. 
[\[annotate\]](edit/anno?aid=912E5CEF5561E0B539196E8A3728F105%2Fdescribe-presentation-type%2F23.3.4#Z)  
*type* can be a presentation type abbreviation. 
[\[annotate\]](edit/anno?aid=AB5B65984AEEEE9D3FAF0CAA4B6705A3%2Fdescribe-presentation-type%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=A23E5BBFE36D73A21DF06469146764F0%2Fdescribe-presentation-type%2F23.3.4#Z)  
[\[→ describe-presentation-type, *Presentation Method*\]](23-3.html#_1163)    [\[← 23.5 Context-dependent 
(Typed) Input, ****prompt-for-accept-1****\]](23-5.html#_5048)   [\[← 23.3.4 Presentation Type Functions, 
****default-describe-presentation-type****\]](23-3.html#_4872)   [\[← 23.3.3 Presentation Methods, 
****accept-present-default****\]](23-3.html#_4814)   [\[← 23.3.3 Presentation Methods, 
****define-presentation-method****\]](23-3.html#_4744)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4680) |
| --- | --- |

| **presentation-type-parameters** | *type-name* *&optional* *env* | \[Function\] |
| --- | --- | --- |

|  | Returns a lambda-list, the parameters specified when the presentation type or presentation type 
abbreviation whose name is *type-name* was defined. *type-name* is a symbol or a class. *env* is a 
macro-expansion environment, as in **find-class**. 
[\[annotate\]](edit/anno?aid=EA365FE91D4D68790883E552854A16AF%2Fpresentation-type-parameters%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=BEF71B5360A9E91C98A60BA28698727B%2Fpresentation-type-parameters%2F23.3.4#Z) |
| --- | --- |

| **presentation-type-options** | *type-name* *&optional* *env* | \[Function\] |
| --- | --- | --- |

|  | Returns the list of options specified when the presentation type or presentation type abbreviation whose 
name is *type-name* was defined. This does not include the standard options unless the presentation-type 
definition mentioned them explicitly. *type-name* is a symbol or a class. *env* is a macro-expansion 
environment, as in **find-class**. 
[\[annotate\]](edit/anno?aid=099233D688B46384E3F35FA6ACEA034E%2Fpresentation-type-options%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=A26A25C5CE46DBCE854945E475118317%2Fpresentation-type-options%2F23.3.4#Z) |
| --- | --- |

| **with-presentation-type-decoded** | *(name-var* *&optional* *parameters-var options-var) type* *&body* 
*body* | \[Macro\] |
| --- | --- | --- |

|  | The specified variables are bound to the components of the presentation type specifier produced by 
evaluating *type*, the forms in *body* are executed, and the values of the last form are returned. 
*name-var*, if non- [**nil**](23-8.html#_1254), is bound to the presentation type name. *parameters-var*, if 
non- [**nil**](23-8.html#_1254), is bound to a list of the parameters. *options-var*, if non- 
[**nil**](23-8.html#_1254), is bound to a list of the options. When supplied, *name-var*, *parameters-var*, 
and *options-var* must be symbols. 
[\[annotate\]](edit/anno?aid=47B8293528546BA7F815FC49F11740B7%2Fwith-presentation-type-decoded%2F23.3.4#Z)  
The *name-var*, *parameters-var*, and *options-var* arguments are not evaluated. *body* may have zero or more 
declarations as its first forms. 
[\[annotate\]](edit/anno?aid=47F065EC1219296E21C31A23E3D25E77%2Fwith-presentation-type-decoded%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=6018741AFAC9045D75EA09ADD1A62811%2Fwith-presentation-type-decoded%2F23.3.4#Z) |
| --- | --- |

| **presentation-type-name** | *type* | \[Function\] |
| --- | --- | --- |

|  | Returns the presentation type name of the presentation type specifier *type*. This function is provided 
as a convenience. It could be implemented with the following code: 
[\[annotate\]](edit/anno?aid=12630E450F369AECF40F4B3523CEBB89%2Fpresentation-type-name%2F23.3.4#Z)  ``` 
(defun presentation-type-name (type)   (with-presentation-type-decoded (name) type     name)) ```  
[\[annotate\]](edit/anno?aid=9D47B7EBA49FA03767DEF15A758D4F80%2Fpresentation-type-name%2F23.3.4#Z) |
| --- | --- |

| **with-presentation-type-parameters** | *(type-name type)* *&body* *body* | \[Macro\] |
| --- | --- | --- |

|  | Variables with the same name as each parameter in the definition of the presentation type are bound to 
the parameter values in *type*, if present, or else to the defaults specified in the definition of the 
presentation type. The forms in *body* are executed in the scope of these variables and the values of the 
last form are returned. 
[\[annotate\]](edit/anno?aid=CC6E1EC96AF026D505DF38269AB92B32%2Fwith-presentation-type-parameters%2F23.3.4#Z) 
 The value of the form *type* must be a presentation type specifier whose name is *type-name*. The 
*type-name* and *type* arguments are not evaluated. *body* may have zero or more declarations as its first 
forms. 
[\[annotate\]](edit/anno?aid=DA05B64EEC662BC3C2E4D541FD1A729E%2Fwith-presentation-type-parameters%2F23.3.4#Z) 
 
[\[annotate\]](edit/anno?aid=7D324EF8612C35F1E659AC5429ED8855%2Fwith-presentation-type-parameters%2F23.3.4#Z) 
|
| --- | --- |

| **with-presentation-type-options** | *(type-name type)* *&body* *body* | \[Macro\] |
| --- | --- | --- |

|  | Variables with the same name as each option in the definition of the presentation type are bound to the 
option values in *type*, if present, or else to the defaults specified in the definition of the presentation 
type. The forms in *body* are executed in the scope of these variables and the values of the last form are 
returned. 
[\[annotate\]](edit/anno?aid=29550AFB56D0E7131472CB392A120086%2Fwith-presentation-type-options%2F23.3.4#Z)  
The value of the form *type* must be a presentation type specifier whose name is *type-name*. The *type-name* 
and *type* arguments are not evaluated. *body* may have zero or more declarations as its first forms. 
[\[annotate\]](edit/anno?aid=DA05B64EEC662BC3C2E4D541FD1A729E%2Fwith-presentation-type-options%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=339B8F4A9DA6CEC0CB5330C949C74CC5%2Fwith-presentation-type-options%2F23.3.4#Z) |
| --- | --- |

| **presentation-type-specifier-p** | *object* | \[Function\] |
| --- | --- | --- |

|  | Returns true if *object* is a valid [presentation type specifier](23-3.html#_1146), otherwise returns 
false. 
[\[annotate\]](edit/anno?aid=0E45050A0D7770F6E66ACBCCA9AFBA1C%2Fpresentation-type-specifier-p%2F23.3.4#Z)  
*Note:* What should be done if \`object' is an unknown presentation type specifier? An error? 
[\[edit\]](edit/anno?aid=0E45050A0D7770F6E66ACBCCA9AFBA1C%2Fpresentation-type-specifier-p%2F23.3.4&editp=t&id=
Z154#Z154) *\-- Troels "Athas" Henriksen 2006-12-12 19:52Z*  
[\[annotate\]](edit/anno?aid=A2AB5EFCDC32EB7E6B20D3548FB1036D%2Fpresentation-type-specifier-p%2F23.3.4#Z)  
[\[→ presentation-type-specifier-p, *Presentation Method*\]](23-3.html#_1164)    [\[← 23.3.3 Presentation 
Methods, ****define-presentation-method****\]](23-3.html#_4745)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4697) |
| --- | --- |

| **presentation-typep** | *object type* | \[Function\] |
| --- | --- | --- |

|  | Returns true if *object* is of the presentation type specified by the [presentation type 
specifier](23-3.html#_1146) *type*, otherwise returns false. 
[\[annotate\]](edit/anno?aid=605D2FD1F4A8E00EDF49E20E15F89C44%2Fpresentation-typep%2F23.3.4#Z)  *type* may 
not be a presentation type abbreviation. 
[\[annotate\]](edit/anno?aid=1198061000ED954DA8B5CB7F160925BF%2Fpresentation-typep%2F23.3.4#Z)  This is 
analogous to the Common Lisp **typep** function. 
[\[annotate\]](edit/anno?aid=E3196AC70086DE2C23F9DA0B9E4CBBFC%2Fpresentation-typep%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=3E0CD5E43371C74F6912A2F4117B1C99%2Fpresentation-typep%2F23.3.4#Z)  [\[→ 
presentation-typep, *Presentation Method*\]](23-3.html#_1165)    [\[← 23.7.4 Translator 
Applicability\]](23-7.html#_5230)   [\[← 23.7.1 Defining Presentation Translators, 
****define-presentation-translator****\]](23-7.html#_5113)   [\[← 23.3.3 Presentation 
Methods\]](23-3.html#_4722)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4664)   [\[← 23.3 Presentation Types\]](23-3.html#_4644) |
| --- | --- |

| **presentation-type-of** | *object* | \[Function\] |
| --- | --- | --- |

|  | Returns a presentation type of which *object* is a member. **presentation-type-of** returns the most 
specific presentation type that can be conveniently computed and is likely to be useful to the programmer. 
This is often the class name of the class of the object. 
[\[annotate\]](edit/anno?aid=3F9A267EDC6E9E3836B1E8942C7AD3EE%2Fpresentation-type-of%2F23.3.4#Z)  If 
**presentation-type-of** cannot determine the presentation type of the object, it may return either 
[**expression**](23-8.html#_1294) or [**t**](23-8.html#_1253). 
[\[annotate\]](edit/anno?aid=A44AE232812BFC25063AF4DBE6321245%2Fpresentation-type-of%2F23.3.4#Z)  This is 
analogous to the Common Lisp **typep** function. 
[\[annotate\]](edit/anno?aid=E3196AC70086DE2C23F9DA0B9E4CBBFC%2Fpresentation-type-of%2F23.3.4#Z)  *Note:* 
Exactly how is this analogous? Was \`type-of' intended? 
[\[edit\]](edit/anno?aid=E3196AC70086DE2C23F9DA0B9E4CBBFC%2Fpresentation-type-of%2F23.3.4&editp=t&id=Z145#Z145
) *\-- Troels "Athas" Henriksen 2006-10-19 20:09Z*  
[\[annotate\]](edit/anno?aid=7DF7192217E2D14B35144C4323FF1AA6%2Fpresentation-type-of%2F23.3.4#Z)  *Note:* I 
think that in the old days \`one-argument TYPEP' was what we now call TYPE-OF, so this is probably a braino 
from some old-timer. (I should say that this is hearsay; I wasn't born when CL was invented;-) 
[\[edit\]](edit/anno?aid=7DF7192217E2D14B35144C4323FF1AA6%2Fpresentation-type-of%2F23.3.4&editp=t&id=Z150#Z150
) *\-- Christophe Rhodes 2006-11-16 17:06Z* |
| --- | --- |

| **presentation-subtypep** | *type putative-supertype* | \[Function\] |
| --- | --- | --- |

|  | Answers the question "is the type specified by the [presentation type specifier](23-3.html#_1146) *type* 
a subtype of the type specified by the [presentation type specifier](23-3.html#_1146) *putative-supertype*?". 
**presentation-subtypep** returns two values, *subtypep* and *known-p*. When *known-p* is true, *subtypep* 
can be either true (meaning that *type* is definitely a subtype of *putative-supertype*) or false (meaning 
that *type* is definitely not a subtype of *putative-supertype*). When *known-p* is false, then *subtypep* 
must also be false; this means that the answer cannot reliably be determined. 
[\[annotate\]](edit/anno?aid=7D8E1BFBA22E80A3C84EA9F4F53B6F76%2Fpresentation-subtypep%2F23.3.4#Z)  *type* may 
not be a presentation type abbreviation. 
[\[annotate\]](edit/anno?aid=1198061000ED954DA8B5CB7F160925BF%2Fpresentation-subtypep%2F23.3.4#Z)  This is 
analogous to the Common Lisp **subtypep** function. 
[\[annotate\]](edit/anno?aid=3A449C0E63C05F42066AADBD03504A85%2Fpresentation-subtypep%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=991DE1DD8151316D75386A1CF84E0A75%2Fpresentation-subtypep%2F23.3.4#Z)  [\[→ 
presentation-subtypep, *Presentation Method*\]](23-3.html#_1166)    [\[← 23.7.4 Translator 
Applicability\]](23-7.html#_5227)   [\[← 23.7.1 Defining Presentation Translators, 
****define-presentation-translator****\]](23-7.html#_5114)   [\[← 23.3.3 Presentation Methods, 
****define-presentation-method****\]](23-3.html#_4741)   [\[← 23.3.1 Defining Presentation Types, 
****define-presentation-type****\]](23-3.html#_4665) |
| --- | --- |

| **map-over-presentation-type-supertypes** | *function type* | \[Function\] |
| --- | --- | --- |

|  | Calls the function *function* on the [presentation type specifier](23-3.html#_1146) *type* and each of 
its supertypes. *function* is called with two arguments, the name of a type and a presentation type specifier 
for that type with the parameters and options filled in. *function* has dynamic extent; its two arguments are 
permitted to have dynamic extent. The traversal of the type lattice is done in the order specified by the 
CLOS class precedence rules, and visits each type in the lattice exactly once. 
[\[annotate\]](edit/anno?aid=FA5AC16644C72A2153491F38A19AF448%2Fmap-over-presentation-type-supertypes%2F23.3.4
#Z)  
[\[annotate\]](edit/anno?aid=419FD6B710B71D5509776FB1AF5A1B26%2Fmap-over-presentation-type-supertypes%2F23.3.4
#Z)  *Note:* What is meant to happen when the presentation type specifier is NIL? The existence of this type 
breaks the assumption that we have hierarchical inheritance, and indeed a fixed supertype list... 
[\[edit\]](edit/anno?aid=419FD6B710B71D5509776FB1AF5A1B26%2Fmap-over-presentation-type-supertypes%2F23.3.4&edi
tp=t&id=Z159#Z159) *\-- Christophe Rhodes 2007-01-09 10:58Z*  [\[→ map-over-presentation-type-supertypes, 
*Presentation Method*\]](23-3.html#_1167) |
| --- | --- |

| **presentation-type-direct-supertypes** | *type* | \[Function\] |
| --- | --- | --- |

|  | Returns a sequence consisting of the names of all of the presentation types that are direct supertypes 
of the [presentation type specifier](23-3.html#_1146) *type*, or [**nil**](23-8.html#_1254) if *type* has no 
supertypes. The consequences of modifying the returned sequence are unspecified. 
[\[annotate\]](edit/anno?aid=D5E59FF3411EB2C62E823A9E7ABACCC4%2Fpresentation-type-direct-supertypes%2F23.3.4#Z
)  
[\[annotate\]](edit/anno?aid=3D85252138CB6666D63DCF7274EB4AF4%2Fpresentation-type-direct-supertypes%2F23.3.4#Z
) |
| --- | --- |

| **find-presentation-type-class** | *name* *&optional* *(errorp* ***t****) environment* | \[Function\] |
| --- | --- | --- |

|  | Returns the class corresponding to the presentation type named *name*, which must be a symbol or a class 
object. *errorp* and *environment* are as for **find-class**. 
[\[annotate\]](edit/anno?aid=72684E19D88556A3635E36905AA915B3%2Ffind-presentation-type-class%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=5CB62CBAF7E7A4C9BC526485B1D3EA1C%2Ffind-presentation-type-class%2F23.3.4#Z)  
[\[← 23.3.4 Presentation Type Functions, ****class-presentation-type-name****\]](23-3.html#_4870) |
| --- | --- |

| **class-presentation-type-name** | *class* *&optional* *environment* | \[Function\] |
| --- | --- | --- |

|  | Returns the presentation type name corresponding to the class *class*. This is essentially the inverse 
of [**find-presentation-type-class**](23-3.html#_1187). *environment* is as for **find-class**. 
[\[annotate\]](edit/anno?aid=2696B735B75E5327391AF6ABD7769A04%2Fclass-presentation-type-name%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=7F5D2AD9AF6B1BCB5002FCE1FADA13D9%2Fclass-presentation-type-name%2F23.3.4#Z) |
| --- | --- |

| **default-describe-presentation-type** | *description stream plural-count* | \[Function\] |
| --- | --- | --- |

|  | Performs the default actions for [**describe-presentation-type**](23-3.html#_1174), notably 
pluralization and prepending an indefinite article if appropriate. *description* is a string or a symbol, 
typically the **:description** presentation type option or the **:description** option to 
[**define-presentation-type**](23-3.html#_1149). *plural-count* is as for 
[**describe-presentation-type**](23-3.html#_1174). 
[\[annotate\]](edit/anno?aid=67AC7A13BF2FD9D3A41EFF23330C14D7%2Fdefault-describe-presentation-type%2F23.3.4#Z)
  
[\[annotate\]](edit/anno?aid=F80273731A92C99433C9CA428A20B44C%2Fdefault-describe-presentation-type%2F23.3.4#Z)
 |
| --- | --- |

| **make-presentation-type-specifier** | *type-name-and-parameters* *&rest* *options* | \[Function\] |
| --- | --- | --- |

|  | A convenient way to assemble a presentation type specifier with only non-default options included. This 
is only useful for abbreviation expanders, not for **:inherit-from**. *type-name-and-parameters* is a 
presentation type specifier, which must be in the **(*****type-name*** ***parameters...*****)** form. 
*options* are alternating keywords and values that are added as options to the presentation type specifier, 
except that if a value is equal to *type-name* 's default, that option is omitted, producing a more concise 
presentation type specifier. 
[\[annotate\]](edit/anno?aid=9D979EF189B86E69E6B242F6D7C5DBC9%2Fmake-presentation-type-specifier%2F23.3.4#Z)  
[\[annotate\]](edit/anno?aid=C754EDB1E6C7016EC102F4D122B0061E%2Fmake-presentation-type-specifier%2F23.3.4#Z) |
| --- | --- |
