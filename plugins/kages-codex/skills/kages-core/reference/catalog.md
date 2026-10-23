# Kages Core 1.14.0 (core)
Neutral lattice system. The base every other system extends.
Any catalog block can be the root. Choose the shape from the content: page for reading/wide/full canvases, section for heroes or chapters, grid for collections, split for two panes, stack for local flow. Navigation is optional; tabs may be primary navigation and sidebars suit persistent workspace navigation.

- shell → core/shell@1.0.0 [kages/shell@1] App frame with sidebar, header and main regions.
  props:  · slots: sidebar, header, main
  use: Optional workspace frame with sidebar, header and main regions. Omit sidebar when it is not useful; page is another root choice. · avoid: Nested workspace shells.
- sidebar → core/sidebar@1.2.0 [kages/nav@1] Collapsible navigation list; one active item.
  props: title:string, items*:array, value:string · events: select, toggle · outputs: value, collapsed · commands: toggle, collapse, expand
  use: Primary navigation between 3–9 sections. Bind `value` to a state key and read it from content blocks with `visible`. · avoid: More than 9 items; put nested content in tabs instead.
- dropdown → core/dropdown@1.3.0 [kages/select@1] Pick exactly one value from a short list.
  props: label:string, options*:array, value:string, placeholder:string, disabled:boolean · events: change · outputs: value · commands: clear
  use: Any single choice; scales to long option lists. · avoid: Two options — use a button pair.
- tabs → core/tabs@1.0.0 [kages/tabs@1] Switch between sibling views.
  props: tabs*:array, value:string · events: change · outputs: value
  use: Switch between sibling views, including primary navigation when it fits the artifact.
- button → core/button@1.1.0 [kages/button@1] Trigger one action.
  props: label*:string, variant:primary|secondary|quiet|danger, size:md|sm, disabled:boolean · events: click
  use: One primary per region; labels are verbs. · avoid: Using a button to show state.
- text-input → core/text-input@1.0.0 [kages/text-input@1] Single-line free text.
  props: label:string, value:string, placeholder:string, help:string, inputType:text|email|number|search, disabled:boolean · events: change · outputs: value · commands: clear
  use: Search boxes, names, short answers. · avoid: Choices from a known list — use dropdown.
- card → core/card@1.0.0 [kages/card@1] Titled container for related content.
  props: title:string, subtitle:string, tone:default|sunken · slots: children, actions
  use: Group one topic's content; header actions go in the `actions` slot. · avoid: Cards inside cards.
- stack → core/stack@1.0.0 [kages/stack@1] Lay children out in a row, column or grid.
  props: direction:row|column, gap:0|1|2|3|4|6|8, columns:number, align:string, justify:string, wrap:boolean · slots: children
  use: Local rows and columns. Use grid for responsive collections, split for unequal panes and page for a canvas. · avoid: Undeclared styling; gap is a token spacing step.
- text → core/text@1.0.0 [kages/text@1] A run of text in one type style.
  props: text*:string, variant:display|title|heading|body|muted|caption|code
  use: Headings, short copy and long-form prose. Compose report chapters with sections; use $tpl for state-driven text.
- badge → core/badge@1.0.0 [kages/badge@1] Short status label.
  props: label*:string, tone:neutral|accent|success|danger|wire
  use: Status next to a title or row. · avoid: Interactive filters.
- stat → core/stat@1.0.0 [kages/stat@1] One headline number with context.
  props: label*:string, value*:number|string, format:text|number|currency|percent, delta:number|string, caption:string
  use: 3–4 KPIs in a stack with `columns`. Feed `value` with `$count`/`$sum` over data. · avoid: More than 6 in a row.
- table → core/table@1.0.0 [kages/table@1] Rows of records under typed columns.
  props: columns*:array, rows*:array, empty:string, dense:boolean · events: rowSelect · outputs: rows
  use: Records; bind `rows` to `$filter` over a data source for interactive filtering. · avoid: Over ~200 rows without paging.
- page → core/page@1.0.0 [kages/page@1] Sidebar-free page with optional header and footer and a reading, wide or full canvas.
  props: width:reading|wide|full, inset:0|1|2|3|4|6|8, gap:0|1|2|3|4|6|8 · slots: header, children, footer
  use: Choose freely: reading for reports, wide for landing pages, full for tools. Any block may be the root. Navigation is optional.
- section → core/section@1.1.0 [kages/section@1] Editorial or hero region with optional title, prose, content and actions.
  props: title:string, eyebrow:string, description:string, level:1|2|3|4, tone:plain|surface|sunken|accent, inset:0|1|2|3|4|6|8, gap:0|1|2|3|4|6|8, palette:inherit|ocean|mint|violet|amber|rose, scale:standard|hero, backdrop:flat|wash · slots: children, actions
  use: Compose heroes and chapters. Use scale:hero with level:1 for the opening, palette:ocean|mint|violet|amber|rose for a meaningful colour family, tone:accent for a tinted region, and backdrop:wash for a soft gradient. Palette affects the region and its controls in both themes; inherit preserves the workspace design. Reuse colours by meaning. Bind title, description or palette to state for a live result. Avoid a box around every section.
- grid → core/grid@1.0.0 [kages/grid@1] Responsive equal-column grid that fits its container and stacks on narrow canvases.
  props: columns:number, minSize:small|medium|large, gap:0|1|2|3|4|6|8 · slots: children
  use: Use for galleries, feature cards and dashboards; columns is the maximum, minSize controls when columns fit. Children remain in source order.
- split → core/split@1.0.0 [kages/split@1] Two flowing panes with a chosen ratio, stacked in source order on narrow canvases.
  props: ratio:equal|wide-start|wide-end, gap:0|1|2|3|4|6|8 · slots: start, end
  use: Use for side-by-side explanation and interaction, image and prose, or input and output. Does not create a sidebar.
- image → core/image@1.0.0 [kages/image@1] Accessible image with a semantic aspect ratio, fit and optional caption.
  props: src*:string, alt*:string, caption:string, ratio:auto|square|landscape|portrait, fit:cover|contain
  use: Use HTTPS URLs, local / paths or raster data URLs. Provide descriptive alt text; use empty alt only for decoration.
- code → core/code@1.1.0 [kages/code@1] Literal source code or structured text; displayed, never executed.
  props: code*:string, language:string, caption:string, wrap:boolean, highlight:boolean
  use: Display examples, JSON, logs or source. Content remains literal text even when it contains markup. Set language (js, ts, json, sh, py, yaml, sql, go, rust, java, c…) to colour keywords, strings, numbers and comments; unknown languages stay plain, and highlight:false turns it off.
- list → core/list@1.0.0 [kages/list@1] Ordered or unordered prose list.
  props: items*:array, ordered:boolean
  use: Use for instructions, summaries and checklists; items are text, ordered enables numbered steps.
- divider → core/divider@1.0.0 [kages/divider@1] Semantic separator between flowing content regions.
  props:
  use: Separate adjacent topics without wrapping them in cards.
- textarea → core/textarea@1.0.0 [kages/textarea@1] Labelled multiline input with public value and change events.
  props: label*:string, value:string, placeholder:string, help:string, rows:3|5|8|12, disabled:boolean · events: change · outputs: value
  use: Use for notes, drafts and longer answers. Read value or bind it to declared state; change emits {value}.
- slider → core/slider@1.0.0 [kages/slider@1] Labelled numeric range input with a live value.
  props: label*:string, value:number, min:number, max:number, step:number, disabled:boolean · events: change · outputs: value
  use: Use for numeric exploration and simulations; change emits {value}. Native arrow keys adjust by step.
- checkbox → core/checkbox@1.0.0 [kages/checkbox@1] Labelled boolean choice with public checked state.
  props: label*:string, checked:boolean, disabled:boolean · events: change · outputs: checked
  use: Use for independent options; change emits {checked}. Space toggles the native checkbox.
- bar-chart → core/bar-chart@1.0.0 [kages/bar-chart@1] Responsive horizontal bars with accessible labels and numeric values.
  props: label*:string, items*:array, format:text|number|currency|percent, empty:string
  use: Use for comparisons; bind items to data or $map. Values stay visible to assistive technology, including negative values.
- composition → core/composition@1.0.0 [kages/composition@1] Reusable document-local composition with typed inputs and a public value output.
  props: name*:string, inputs:object, value:string|number|boolean|object|array|null · slots: children · outputs: value
  use: Define doc.compositions[name] with typed inputs, root, blocks, optional output expression and outputType:{type,enum?}. Use $input inside the definition; read instance.value outside. Definitions expand to ordinary installed blocks; never contain HTML or executable code.
- link → core/link@1.0.0 [kages/link@1] Accessible passive link; executable URL schemes are refused.
  props: label*:string, href*:string, newTab:boolean
  use: Use HTTPS/HTTP, local / paths, #anchors or mailto links. Provide meaningful label text.
- rich-text → core/rich-text@1.1.0 [kages/rich-text@1] Structured headings, paragraphs, quotes, lists and inline emphasis without raw HTML.
  props: nodes*:array
  use: nodes kinds: paragraph, heading (level 2/3/4), quote (optional attribution and href), list (items, ordered), code. Prose accepts text or runs [{text,bold?,italic?,code?,href?,cite?}]. A run with cite:"id" and text:"1" is a superscript link to the references item with that id; the number is the item's position. Strings remain literal.
- text-field → core/text-field@1.1.0 [kages/text-field@1] Named text, email or URL field with native form validation.
  props: label*:string, name:string, required:boolean, disabled:boolean, error:string, value:string, kind:text|email|url, help:string, placeholder:string, minLength:number, maxLength:number · events: change · outputs: value
  use: Use inside form with name and required/minLength/maxLength; email and url use browser validity. change emits {value}. Set error to show a field-level message (bind it to a $if over state for custom rules).
- number-input → core/number-input@1.1.0 [kages/number-input@1] Named numeric field with min/max/step validation; empty value is null.
  props: label*:string, name:string, required:boolean, disabled:boolean, error:string, value:number|null, min:number, max:number, step:number · events: change · outputs: value
  use: Use for calculations; an empty field emits null. Set name inside form; change emits {value}.
- date-input → core/date-input@1.1.0 [kages/date-input@1] Named date field with native picker and ISO date output.
  props: label*:string, name:string, required:boolean, disabled:boolean, error:string, value:string, min:string, max:string · events: change · outputs: value
  use: Date values and bounds are YYYY-MM-DD; change emits {value}.
- choice → core/choice@1.1.0 [kages/choice@1] Named radio group with native keyboard navigation and a public selection.
  props: label*:string, name:string, required:boolean, disabled:boolean, error:string, value:string, options*:array · events: change · outputs: value
  use: Use for one option from a short list; options are [{value,label}]. change emits {value}.
- multiselect → core/multiselect@1.1.0 [kages/multiselect@1] Named multiple selection with native keyboard support and array output.
  props: label*:string, name:string, required:boolean, disabled:boolean, error:string, value:array, options*:array · events: change · outputs: value
  use: Use for several choices; options are [{value,label}], value is a string array. change emits {value}.
- form → core/form@1.0.0 [kages/form@1] Native validated form; submit emits named field values as strings or arrays of strings.
  props: label*:string, submitLabel:string, disabled:boolean · slots: children · events: submit
  use: Place named native fields in children. Invalid fields prevent submit. submit emits {values}: string values, duplicate names become arrays. Wire submit to declared state or a host action.
- scene → core/scene@1.1.0 [kages/scene@1] Responsive vector scene assembled from rect/circle/line/path/text geometry and token colors.
  props: label*:string, width:number, height:number, shapes*:array, interactive:boolean, caption:string · events: select
  use: shapes: {kind:rect|circle|line|path|text,id?,label?,x?,y?,width?,height?,radius?,x2?,y2?,d?,text?,size?,fill?,stroke?,strokeWidth?}. Colors: accent, ink, ink-muted, line, surface, sunken, paper, success, danger; no arbitrary SVG attributes. interactive shapes with id emit select {id} and support Enter/Space. label is the accessible name; caption is the visible sentence under the figure saying what to take from it (it replaces the label as the visible caption).
- diagram → core/diagram@1.2.0 [kages/diagram@1] Node and edge diagram with automatic placement or explicit coordinates.
  props: label*:string, nodes*:array, edges:array, interactive:boolean, caption:string, layout:auto|horizontal|vertical|grid, selected:string, empty:string · events: select · outputs: selected
  use: nodes [{id,label,group?,palette?}], edges [{from,to,label?,palette?}]. Palettes: inherit,ocean,mint,violet,amber,rose; assign by role and reuse across the page. Directed graphs are layered by edges; cycles use a grid. layout:auto becomes vertical in narrow containers; horizontal,vertical,grid are explicit. Full nodes support click/Enter/Space when interactive:true; select emits {id} and selected is public. Bind selected and a detail panel to the same state. group is a short category label. Explicit x/y uses the legacy geometry path (no palettes or selected highlight); use scene for arbitrary geometry. Caption states the takeaway, not just the title.
- line-chart → core/line-chart@1.0.0 [kages/line-chart@1] Responsive numeric X/Y line chart with an accessible data table.
  props: label*:string, items*:array, xLabel:string, yLabel:string, empty:string
  use: items: [{x,y,label?}]. Supply sorted x values for ordered paths. Data is available in a keyboard-accessible table.
- scatter-chart → core/scatter-chart@1.0.0 [kages/scatter-chart@1] Responsive numeric X/Y scatter plot with an accessible data table.
  props: label*:string, items*:array, xLabel:string, yLabel:string, empty:string
  use: items: [{x,y,label?}]. Both axes are numeric; use for correlation and simulations.
- area-chart → core/area-chart@1.0.0 [kages/area-chart@1] Responsive filled area chart of numeric X/Y data with an accessible data table.
  props: label*:string, items*:array, xLabel:string, yLabel:string, empty:string
  use: items: [{x,y,label?}] with sorted x. Use for volume over time; prefer line-chart when several readings overlap.
- donut-chart → core/donut-chart@1.1.0 [kages/donut-chart@1] Part-to-whole ring chart with a legend, percentages and an accessible data table.
  props: label*:string, items*:array, hole:boolean, empty:string, interactive:boolean, selected:string · events: select · outputs: selected
  use: items: [{label,value}] with positive values, at most 12 slices. Use for part-to-whole with few categories; use bar-chart to compare many. Set interactive to make slices selectable: select emits {label,value,index} and the public output `selected` is the label (empty = none); filter other blocks with $filter on it.
- gauge → core/gauge@1.0.0 [kages/gauge@1] Single value on a half-ring scale between a minimum and maximum.
  props: label*:string, value*:number, min:number, max:number, unit:string, tone:accent|success|danger|wire
  use: value within min..max (clamped). tone is a token colour. Use for one KPI against a known scale, not for trends.
- sparkline → core/sparkline@1.0.0 [kages/sparkline@1] Tiny inline trend line for a series of numbers; sits next to a stat or in a table cell.
  props: label*:string, values*:array, tone:accent|success|danger|wire
  use: values: number[]; no axes. Put beside a stat for trend. Provide a label that states what the series is.
- heatmap → core/heatmap@1.1.0 [kages/heatmap@1] Row by column matrix whose cell shading shows magnitude, with every value readable as text.
  props: label*:string, rows*:array, columns*:array, values*:array, empty:string, interactive:boolean, selected:object · events: select · outputs: selected
  use: rows and columns are labels; values[row][column] numbers. Use for intensity across two categories. Missing cells show a dash. interactive makes cells buttons: select emits {row,column,value}; output `selected` is {row,column} or null.
- alert → core/alert@1.0.0 [kages/alert@1] Inline callout for information, success, warning or danger with an optional title and content.
  props: tone:info|success|warning|danger, title:string, text:string · slots: children
  use: tone info|success|warning|danger; title and text, or children. danger and warning announce immediately.
- accordion → core/accordion@1.0.0 [kages/accordion@1] Stack of headings that each reveal a panel; one open at a time with a public value.
  props: items*:array, value:string · events: change · outputs: value
  use: items: [{id,title,body}]; value is the open id (empty closes all). change emits {value}. Use for FAQs and optional detail.
- stepper → core/stepper@1.0.0 [kages/stepper@1] Ordered progress through named steps; optionally clickable, with the current step public.
  props: label*:string, steps*:array, value:string, interactive:boolean · events: change · outputs: value
  use: steps: [{id,label,description?}]; value is the current id. interactive makes steps buttons; change emits {value}. Wire value to state to drive step content with visible.
- timeline → core/timeline@1.0.0 [kages/timeline@1] Chronological list of events with optional times, descriptions and tone.
  props: label*:string, items*:array
  use: items: [{title,time?,description?,tone?}] in order. Use for history, roadmaps and activity logs.
- modal → core/modal@1.0.0 [kages/modal@1] Dialog layered over the artifact; opened and closed by commands, Escape or the close button.
  props: label*:string, open:boolean, closeLabel:string · slots: children · events: change · outputs: open · commands: open, close, toggle
  use: Place content in children. Open with a button command {do:'call',target:modal,command:'open'}; Escape, the backdrop and the close button emit change {open:false}. Use sparingly for confirmations and detail.
- switch → core/switch@1.0.0 [kages/switch@1] Labelled on/off toggle with a public checked state.
  props: label*:string, checked:boolean, disabled:boolean · events: change · outputs: checked
  use: Use for an immediate on/off setting; change emits {checked}. Use checkbox for form-style choices.
- combobox → core/combobox@1.0.0 [kages/combobox@1] Type-to-filter single choice with a keyboard listbox; the value is always one of the options.
  props: label*:string, options*:array, value:string, name:string, placeholder:string, empty:string, required:boolean, disabled:boolean · events: change · outputs: value
  use: Use when the option list is long enough to search. options [{value,label}]; change emits {value}. Free text is not accepted.
- tree → core/tree@1.0.0 [kages/tree@1] Expandable hierarchy with keyboard navigation and a selected node id.
  props: label*:string, nodes*:array, value:string, expandAll:boolean, empty:string · events: select · outputs: value
  use: nodes: [{id,label,children?}] up to depth 8 and 500 nodes. select emits {id}; arrows move, Right/Left expand and collapse.
- data-grid → core/data-grid@1.0.0 [kages/data-grid@1] Sortable, filterable, paged table whose rows can be selected.
  props: label*:string, columns*:array, rows*:array, pageSize:number, filterable:boolean, sortable:boolean, empty:string · events: select · outputs: selected
  use: columns [{key,label}], rows objects. Sorts, filters (filterable) and pages in place; select emits {row,index} and the selected row is the public output.
- kanban → core/kanban@1.0.0 [kages/kanban@1] Columns of cards that move between columns with buttons; the moved board is public.
  props: label*:string, columns*:array, cards*:array · events: move · outputs: board
  use: columns [{id,title}], cards [{id,title,column,description?}]. Buttons move a card; move emits {id,from,to,cards} and the new board is output `board` (null until moved).
- calendar → core/calendar@1.0.0 [kages/calendar@1] Month grid with event dots, month navigation and a selected ISO date.
  props: label*:string, month*:string, events:array, value:string, weekStart:0|1 · events: change · outputs: value
  use: month is YYYY-MM (required, so the render is deterministic). events [{date:YYYY-MM-DD,title}]. change emits {value}; weekStart 0 or 1.
- carousel → core/carousel@1.0.0 [kages/carousel@1] One slide at a time with previous/next, dots and arrow keys; the slide index is public.
  props: label*:string, slides*:array, index:number, empty:string · events: change · outputs: index
  use: slides [{title?,text?,src?,alt?}]; image src follows the image block's passive rules. change emits {index}.
- markdown → core/markdown@1.0.0 [kages/markdown@1] Markdown subset (headings, lists, quotes, code, emphasis, links, $math$) rendered as elements, never HTML.
  props: text*:string
  use: Subset only: #-### headings, lists, > quotes, ``` code, **bold**, *italic*, `code`, [links](https://…) and $tex$ / $block$ math. No raw HTML.
- math → core/math@1.0.0 [kages/math@1] TeX math (fractions, roots, scripts and limits, matrices, cases, accents, stretchy delimiters, Greek and symbols) rendered as accessible elements.
  props: tex*:string, display:boolean, label:string
  use: TeX math, not LaTeX documents: \frac \binom \sqrt[n]{} ^ _ \sum_{i}^{n} \int \lim, \left( \right), \begin{pmatrix|bmatrix|vmatrix|cases|aligned}…\end, \hat \vec \overline, \text{} \mathbb \mathcal \mathbf, Greek and common symbols. display:true stacks limits above and below. Unknown commands render as their name; no macros, no packages.
- combo-chart → core/combo-chart@1.0.0 [kages/combo-chart@1] Grouped bars and lines on one shared axis for categories, with a legend and data table.
  props: label*:string, categories*:array, series*:array, xLabel:string, empty:string
  use: categories: string[]; series: [{name,kind:'bar'|'line',values:number[]}] aligned to categories (null gaps allowed). Use to compare a volume (bars) with a rate or target (line). One axis only.
- stacked-bar-chart → core/stacked-bar-chart@1.0.0 [kages/stacked-bar-chart@1] Stacked columns of series per category, absolute or normalised to 100%.
  props: label*:string, percent:boolean, categories*:array, series*:array, xLabel:string, empty:string
  use: categories + series [{name,values}]. percent:true normalises each column to 100%. Negative values are ignored; use combo-chart for signed data.
- funnel-chart → core/funnel-chart@1.0.0 [kages/funnel-chart@1] Ordered stages narrowing by value, with the share of the first stage; stages can be selected.
  props: interactive:boolean, selected:string, label*:string, stages*:array, empty:string · events: select · outputs: selected
  use: stages: [{label,value}] in order, values non-increasing for a true funnel. interactive: select emits {label,value,index}; output `selected` is the label (selecting again clears).
- treemap → core/treemap@1.0.0 [kages/treemap@1] Rectangles sized by value, packed to near-square, with optional selection.
  props: interactive:boolean, selected:string, label*:string, items*:array, empty:string · events: select · outputs: selected
  use: items: [{label,value}] with positive values (up to 80). Use for part-to-whole with many parts; interactive select emits {label,value,index}; output `selected` is the label.
- sankey → core/sankey@1.0.0 [kages/sankey@1] Flows between nodes in left-to-right layers, with widths proportional to value.
  props: label*:string, nodes*:array, links*:array, empty:string
  use: nodes [{id,label?}], links [{from,to,value>0}]. Layers are computed left to right; links must point forward (cycles are dropped). Use for flows such as budget or conversion paths.
- map → core/map@1.0.0 [kages/map@1] Choropleth of GeoJSON Polygon/MultiPolygon regions shaded by value, with optional selection.
  props: interactive:boolean, selected:string, label*:string, features*:array, empty:string · events: select · outputs: selected
  use: features: [{id,name?,value?,geometry}] where geometry is GeoJSON Polygon or MultiPolygon in [lon,lat]. Shades by value; interactive select emits {id,name,value}; output `selected` is the id. Bring simplified boundaries: 20,000 points total.
- tab-panel → core/tab-panel@1.0.0 [kages/tab-panel@1] Tabs whose panels hold blocks: panel1..panel6 map to the tabs in order, and only the selected panel shows.
  props: label*:string, tabs*:array, value:string · slots: panel1, panel2, panel3, panel4, panel5, panel6 · events: change · outputs: value
  use: tabs: [{id,label}] (max 6); put each tab's blocks in slot panel1, panel2… in the same order. Empty value means the first tab. change emits {id}. Use for alternatives, not for sequence (use stepper).
- code-tabs → core/code-tabs@1.0.0 [kages/code-tabs@1] One code listing in several languages behind tabs, with a copy button; code is displayed, never run.
  props: caption:string, tabs*:array, value:string · events: change · outputs: value
  use: tabs: [{id,label,language?,code}]. Use for the same snippet in several languages or shells. Code is literal text; the copy button copies the visible tab.
- anchor → core/anchor@1.0.0 [kages/anchor@1] Invisible jump target; place it just before a heading so a table of contents can link to it.
  props: name*:string
  use: name becomes a jump target (letters, digits, - and _). Put one before each heading you want to link to.
- toc → core/toc@1.0.0 [kages/toc@1] On-this-page outline of links that scroll to anchors, highlighting the section in view.
  props: title:string, items*:array, sticky:boolean, value:string · events: select · outputs: value
  use: items: [{label,target,level?}] where target is an anchor name defined by an `anchor` block on the same page. sticky keeps it in view while scrolling. Every target needs a matching anchor.
- video → core/video@1.0.0 [kages/video@1] Video with native controls, optional poster, captions and transcript; never autoplays.
  props: label*:string, src*:string, poster:string, caption:string, transcript:string, captions:array
  use: src is an https URL or local path. Add captions [{src,lang,label}] and a transcript for accessibility. No autoplay, no embeds of third-party players.
- audio → core/audio@1.0.0 [kages/audio@1] Audio with native controls, optional captions and transcript; never autoplays.
  props: label*:string, src*:string, caption:string, transcript:string, captions:array
  use: src is an https URL or local path. Add a transcript for accessibility. No autoplay.
- glossary → core/glossary@1.0.0 [kages/glossary@1] Terms and their meanings as a description list.
  props: title:string, items*:array
  use: items: [{term,definition}] in the order to read them; one sentence per definition. Put it near the end of a long page. Define a term where it is first used too.
- references → core/references@1.0.0 [kages/references@1] Numbered sources a page cites; rich-text cite runs link to them by id.
  props: title:string, items*:array
  use: items: [{id,label,href?,detail?}] in citation order; the list is numbered 1, 2, 3… in that order. In prose, cite with a rich-text run {text:"1",cite:"<id>"} whose text is the item's position. href is https; detail is the publisher or author. Every cited id must exist here, and every claim from a source should cite it.
- gallery → core/gallery@1.0.0 [kages/gallery@1] Grid of thumbnails opening a keyboard-operable lightbox; the open image index is public (-1 = closed).
  props: label*:string, items*:array, index:number, empty:string · events: change · outputs: index
  use: items: [{src,alt,caption?}] with the image block's source rules. Thumbnails open a lightbox; arrows navigate, Escape closes. index -1 means closed.
- date-range → core/date-range@1.0.0 [kages/date-range@1] Start and end dates with native pickers; flags an end before the start. Value is {start,end} (ISO dates).
  props: label*:string, value:object, name:string, min:string, max:string, required:boolean, disabled:boolean, error:string · events: change · outputs: value
  use: Use for periods and bookings. value is {start,end}; change emits {start,end}. An end before the start shows an inline message. min/max bound both dates.
- file-upload → core/file-upload@1.0.0 [kages/file-upload@1] Pick files read locally in the browser: reports name, size, type and the text of small text files; nothing is uploaded.
  props: label*:string, accept:string, multiple:boolean, maxBytes:number, readAs:text|none, name:string, help:string, required:boolean, disabled:boolean, error:string, files:array · events: change · outputs: files
  use: Local read only. accept like '.csv,text/plain'; maxBytes up to 1,000,000 (default 100,000); multiple allows up to 5. change emits {files:[{name,size,type,text|null,error}]}. Bind the output into state to preview or parse it with blocks; there is no upload.