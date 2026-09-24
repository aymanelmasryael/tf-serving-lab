# Contract System Documentation

## Contract DSL Grammar

```
contract <Name> {
    <field_name>: <type> [ [] ] [ ? ] [ = <default> ] [ @<decorator>(<args>) ... ]
    ...
}
```

## Supported Types

| Type | TypeScript | Description |
|------|------------|-------------|
| `string` | `string` | UTF-8 string |
| `int` | `number` | 32-bit integer |
| `float` | `number` | IEEE 754 double |
| `bool` | `boolean` | true/false |
| `any` | `unknown` | Any JSON value |
| `json` | `unknown` | Alias for `any` |

Arrays: append `[]` (e.g., `string[]`, `int[]`)
Optional: append `?` (e.g., `string?`, `int[]?`)
Default: `= <value>` (JSON-parsed, or number/boolean/string literal)

## Decorators

| Decorator | Arguments | Applies To | Validation |
|-----------|-----------|------------|------------|
| `@min` | `<n>` | string (length), int/float (value) | `value >= n` |
| `@max` | `<n>` | string (length), int/float (value) | `value <= n` |
| `@range` | `<min>,<max>` | int/float | `min <= value <= max` |
| `@pattern` | `<regex>` | string | `regex.test(value)` |
| `@enum` | `<v1>,<v2>,...` | any | `value in [v1,v2,...]` |
| `@maxItems` | `<n>` | arrays | `array.length <= n` |

## Example Contract

```dsl
contract GenerationRequest {
  // Required prompt, 1-512 characters
  prompt: string @min(1) @max(512)
  
  // Optional with default, range validated
  max_tokens: int = 128 @range(1,1024)
  temperature: float = 0.7 @range(0.0,2.0)
  
  // Optional fields (no default = undefined if omitted)
  top_k: int? @range(1,100)
  top_p: float? @range(0.0,1.0)
  
  // Boolean with default
  stream: bool = false
  
  // Optional string array, max 4 items
  stop: string[]? @maxItems(4)
}
```

## Parsed Representation

```javascript
{
  name: "GenerationRequest",
  fields: [
    {
      name: "prompt",
      type: "string",
      array: false,
      optional: false,
      decos: [
        { name: "min", args: ["1"] },
        { name: "max", args: ["512"] }
      ],
      def: undefined,
      line: 3
    },
    {
      name: "max_tokens",
      type: "int",
      array: false,
      optional: true,  // has default
      decos: [{ name: "range", args: ["1", "1024"] }],
      def: 128,
      line: 5
    },
    // ... more fields
  ],
  diags: []  // empty if valid
}
```

## TypeScript Generation

Input: parsed contract above

Output:
```typescript
// compiled · GenerationRequest
// runtime-validated at the TF Serving boundary
export interface GenerationRequest {
  prompt: string;                          // @min(1) · @max(512) · required
  max_tokens?: number;                     // @range(1, 1024) · default 128
  temperature?: number;                    // @range(0, 2) · default 0.7
  top_k?: number;                          // @range(1, 100) · required
  top_p?: number;                          // @range(0, 1) · required
  stream?: boolean;                        // default false
  stop?: string[];                         // @maxItems(4) · required
}
```

**Rules:**
- Fields with defaults or `?` become optional (`?`)
- Arrays: `type[]`
- Decorators and defaults shown as trailing comments
- Syntax highlighted in UI (keywords, strings, numbers, comments)

## Runtime Validation

```javascript
const diags = validateBody(parsedJson, contract);
// Returns array of { path, sev: "error"|"warn", msg }
```

**Validation Steps:**

1. **Root type check**: Body must be a non-null object (not array)
2. **Unknown fields**: Warn for fields not in contract
3. **Required fields**: Error if missing and no default
4. **Type check**: Per-field type validation
   - `string` → `typeof === "string"`
   - `int` → `Number.isInteger()` + finite
   - `float` → `typeof === "number"` + finite
   - `bool` → `typeof === "boolean"`
   - `any`/`json` → always pass
5. **Array element type check**: If `array: true`, validate each element
6. **Decorator validation**: Apply each decorator's constraint
   - `@min`/`@max`: string length or numeric value
   - `@range`: inclusive bounds
   - `@maxItems`: array length
   - `@pattern`: RegExp test (catches invalid regex as warning)
   - `@enum`: value in allowed list
   - Unknown decorators: warning

## Diagnostic Rendering

```html
<div class="diag error">
  <span class="l">L3</span>
  <span class="p">$.prompt</span>
  <span>length 0 < min 1</span>
</div>
<div class="diag warn">
  <span class="l">•</span>
  <span class="p">$.unknown_field</span>
  <span>unknown field "unknown_field" is not part of GenerationRequest</span>
</div>
<div class="diag ok">
  <span class="p">✓</span>
  <span>payload satisfies GenerationRequest — forwarded to TF Serving</span>
</div>
```

- **Red (error)**: Contract violation, blocks inference
- **Yellow (warn)**: Non-blocking (unknown fields, invalid decorators)
- **Green (ok)**: Success message when no diagnostics

## Inference Request Flow

```
User types JSON in Request Editor
         │
         ▼
[Validate & Infer] button clicked
         │
         ▼
runInference(S, contract, elements, chan)
         │
         ├── JSON.parse() → catch malformed JSON
         │
         ├── validateBody(body, contract) → diags
         │
         ├── renderDiags(requestDiags, diags, okMsg)
         │
         ├── If errors: render 400 response, log, broadcast log, RETURN
         │
         ├── Merge defaults: req[f] = body[f] ?? f.def
         │
         ├── Simulate timings (queue, prefill, decode)
         │
         ├── Generate response object
         │
         ├── Render JSON response
         │
         ├── Log success (200 OK, tokens, tok/s)
         │
         └── Broadcast log to peers
```

## Sample Contracts

### Valid Request (matches default contract)
```json
{
  "prompt": "Explain tensor parallelism in one paragraph.",
  "max_tokens": 256,
  "temperature": 0.9,
  "top_k": 40,
  "stream": true,
  "stop": ["\n\n", "###"]
}
```

### Invalid Request (exercises all validators)
```json
{
  "prompt": "",                    // @min(1) violation
  "max_tokens": 9000,              // @range(1,1024) violation
  "temperature": "hot",            // type mismatch (string vs float)
  "top_k": 250,                    // @range(1,100) violation
  "stream": true,
  "stop": ["a","b","c","d","e","f"],  // @maxItems(4) violation
  "top_p": 3.4                     // @range(0.0,1.0) violation
}
```

## Limitations (NOT IMPLEMENTED)

- Nested objects (`address: { street: string, city: string }`)
- Union types (`status: "pending" | "complete"`)
- Recursive types
- Custom validators (functions)
- Async validation
- Schema versioning/migration
- OpenAPI/Swagger export
- JSON Schema export