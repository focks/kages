Feature: Expression language
  Expressions are JSON objects whose first key is an operator. The operator
  set is closed, pure and synchronous. Nothing in a Kage is executed as code.

  Scenario: Reading app state
    Given a Kage with state {"filters": {"region": "north"}}
    When the expression {"$state": "filters.region"} is evaluated
    Then it returns "north"

  Scenario: Reading another block's declared output
    Given block "ordersTable" declares "rows" in its contract outputs
    When the expression {"$block": "ordersTable.rows"} is evaluated
    Then it returns the resolved rows of "ordersTable"

  Scenario: Reading a private key of another block is invalid
    Given block "nav" does not list "secret" in its contract outputs
    When a document binds {"$block": "nav.secret"}
    Then the validator reports error code "private-output" at that path

  Scenario: $self reads the current block
    Given a sidebar block with local state collapsed = true
    When {"$self": "collapsed"} is evaluated inside its contract
    Then it returns true

  Scenario: $event is only available inside action handlers
    When {"$event": "value"} is evaluated inside an "on.change" action
    Then it returns the "value" field of the current event payload

  Scenario: $data reads a dataset
    Given data {"orders": [{"id": "A-1"}]}
    When {"$data": "orders"} is evaluated
    Then it returns the orders array

  Scenario Outline: Boolean and comparison operators
    When <expression> is evaluated
    Then it returns <result>

    Examples:
      | expression                  | result |
      | {"$not": false}             | true   |
      | {"$and": [true, true]}      | true   |
      | {"$or": [false, true]}      | true   |
      | {"$eq": ["a", "a"]}         | true   |
      | {"$neq": ["a", "b"]}        | true   |

  Scenario: $eq uses strict equality
    When {"$eq": [1, "1"]} is evaluated
    Then it returns false

  Scenario: $if returns the matching branch
    When {"$if": [true, "yes", "no"]} is evaluated
    Then it returns "yes"

  Scenario: $tpl fills template holes from namespaces
    Given state {"region": "west"} and block "nav" with output value = "orders"
    When {"$tpl": "Region: {{state.region}} · {{block.nav.value}}"} is evaluated
    Then it returns "Region: west · orders"

  Scenario: $tpl stringifies object values as JSON
    Given state key "rows" holds an array of objects
    When a $tpl interpolates {{state.rows}}
    Then the hole is filled with the JSON serialization of the array

  Scenario: $filter by field equality
    Given a list of orders with regions "north" and "west"
    When {"$filter": {"list": L, "field": "region", "equals": "west"}} is evaluated
    Then only orders with region "west" are returned

  Scenario: $filter skipIf disables the test
    When {"$filter": {"list": L, "field": "region", "equals": "all", "skipIf": "all"}} is evaluated
    Then the full list is returned unfiltered

  Scenario: $filter by substring over several fields
    When {"$filter": {"list": L, "contains": "ti", "fields": ["customer", "id"]}} is evaluated
    Then only items whose customer or id contains "ti" are returned

  Scenario: Aggregations
    Given a list L of orders with totals 100 and 200
    Then {"$count": L} returns 2
    And {"$sum": [L, "total"]} returns 300
    And {"$find": {"list": L, "field": "total", "equals": 200}} returns that order
    And $find returns null when nothing matches

  Scenario: $map shapes a list
    Given data "regions" is a list of {id, name}
    When {"$map": {"list": {"$data": "regions"}, "to": {"value": {"$item": "id"}, "label": {"$item": "name"}}}} is evaluated
    Then it returns a list of {value, label} objects

  Scenario: Literals and nesting
    When an object without a leading operator key is evaluated
    Then it is treated as a literal and its values are walked recursively

  Scenario: The operator set is closed
    When a document uses an operator not in the specification
    Then validation fails and no code path evaluates it

  Scenario: No code execution and no prototype access
    Given any Kage document
    Then no string from the document is ever executed as code
    And getPath reads own data keys only, refusing "__proto__", "constructor" and "prototype"
    And no expression can reach window or any function

  Scenario: Expressions are pure and synchronous
    When any expression is evaluated twice against the same (document, state, locals, data)
    Then it returns the same value and causes no side effects
