export interface HelpControl {
  keys: string[];
  title: string;
  detail: string;
  /** CSS selector for the guided tour. Steps without one are shown centered. */
  target?: string;
  /** Shorter wording used in the tour tooltip. */
  tour?: string;
}

export interface HelpStep {
  title: string;
  detail: string;
}

export interface HelpWorkflow {
  title: string;
  summary: string;
  steps: HelpStep[];
}

export interface HelpGuide {
  slug: string;
  name: string;
  summary: string;
  whatItIs: string;
  goodFor: string[];
  notGoodFor: string[];
  features: string[];
  workflows: HelpWorkflow[];
  controls: HelpControl[];
}

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string;
  placement?: "center" | "top" | "bottom" | "left" | "right";
}

export const HELP_GUIDES: HelpGuide[] = [
  {
    slug: "compose",
    name: "Icon Compose",
    summary: "Draw and edit vector icons and marks.",
    whatItIs:
      "A small vector editor for marks, glyphs and icons. Draw shapes, add text, morph a path, then export SVG or PNG straight into the current project.",
    goodFor: [
      "Simple geometric marks and icon sets",
      "Quick variations of a logo before committing to it",
      "Editable SVG output with named layers",
      "Preparing a source mark for Brand Assets and Expo Assets",
    ],
    notGoodFor: [
      "Detailed illustrations or photo editing",
      "Complex multi-page layouts or long-form typography",
      "Pixel-perfect font rendering — text is converted to paths",
      "Animating or exporting motion graphics",
    ],
    features: [
      "Every drawing is saved as a project document, so you can reopen and tweak it.",
      "Generated files are added to the project's shared asset library.",
      "Morph corners turns a rectangle into a custom silhouette you can keep editing.",
      "Focus mode hides the panels when you just want to look at the artwork.",
      "Press ? on any screen for the full shortcut list.",
    ],
    workflows: [
      {
        title: "Draw and style a mark",
        summary: "From an empty canvas to a finished icon you can export.",
        steps: [
          {
            title: "Draw the first shape",
            detail:
              "Pick Rectangle with R and drag on the canvas. Hold Shift while dragging for a perfect square.",
          },
          {
            title: "Change its colour",
            detail:
              "Keep the shape selected and set the fill and stroke in the inspector on the right. The change applies immediately.",
          },
          {
            title: "Add the rest of the mark",
            detail:
              "Switch to Ellipse (E) or the Pen (P) and draw the remaining pieces. Each one stays a separate, editable object.",
          },
          {
            title: "Reshape with points",
            detail:
              "Press N for Node / morph, then drag the round handles to move corners and curves into the silhouette you want.",
          },
          {
            title: "Fit and export",
            detail:
              "Press ⌘0 to fit the whole drawing, then use Download PNG or Copy to take the result into another tool.",
          },
        ],
      },
      {
        title: "Group, ungroup and detach",
        summary: "Keep a multi-part mark together without losing control of its pieces.",
        steps: [
          {
            title: "Select several objects",
            detail:
              "Hold Shift and click each shape on the canvas, or drag a selection box around them.",
          },
          {
            title: "Group them",
            detail: "Press ⌘G (Ctrl G on Windows). The shapes now move and resize as one object.",
          },
          {
            title: "Ungroup when you need a part",
            detail: "Press ⌘⇧G. The objects split apart again and their transforms are preserved.",
          },
          {
            title: "Detach one nested object",
            detail:
              "Use Detach to pull a single object out of a group without flattening the rest of it.",
          },
        ],
      },
      {
        title: "Clean up a dropped-in SVG",
        summary: "Take artwork from elsewhere and make it editable here.",
        steps: [
          {
            title: "Bring the SVG in",
            detail:
              "Add the SVG to the project library, then open it in Icon Compose. It arrives as editable objects.",
          },
          {
            title: "Replace stray paths with lines",
            detail: "Use the Line tool (L) to draw over broken edges, then delete the old path.",
          },
          {
            title: "Reposition with the dot handles",
            detail:
              "Switch to Node / morph and drag the dot handles to move individual points until the shape sits right.",
          },
          {
            title: "Convert a shape to a path",
            detail: "Object to Path (⌘⇧C) lets you morph a plain shape as freely as a drawn path.",
          },
          {
            title: "Export the cleaned version",
            detail:
              "Download the result — generated files are committed back to the project asset library.",
          },
        ],
      },
    ],
    controls: [
      {
        keys: ["V"],
        title: "Select",
        detail:
          "Pick, move and resize objects. Click an object to select it; drag a corner to resize.",
        target: 'button[aria-label="Select"]',
        tour: "Select is your default tool. Click a shape to select it, drag to move, drag a handle to resize.",
      },
      {
        keys: ["R"],
        title: "Rectangle",
        detail: "Drag on the canvas to draw a rectangle. Hold Shift while dragging for a square.",
        target: 'button[aria-label="Rectangle"]',
      },
      {
        keys: ["E"],
        title: "Ellipse",
        detail: "Drag to draw a circle or ellipse. Hold Shift for a perfect circle.",
        target: 'button[aria-label="Ellipse"]',
      },
      {
        keys: ["L"],
        title: "Line",
        detail: "Draw a straight line between two points. Endpoints stay draggable afterwards.",
        target: 'button[aria-label="Line"]',
      },
      {
        keys: ["P"],
        title: "Pen",
        detail: "Click to place points, then click the first point again to close the path.",
        target: 'button[aria-label="Pen"]',
      },
      {
        keys: ["T"],
        title: "Text",
        detail: "Add a text object. Type in the inspector to change the content and size.",
        target: 'button[aria-label="Text"]',
      },
      {
        keys: ["N"],
        title: "Node / morph",
        detail: "Switch to editing individual points of a path so you can reshape any object.",
        target: 'button[aria-label="Node / morph"]',
      },
      {
        keys: ["K"],
        title: "Morph corners",
        detail: "Round or cut the corners of the selected shape. Great for app-icon silhouettes.",
        target: 'button[aria-label="Morph corners"]',
      },
      {
        keys: ["⌘Z", "Ctrl Z"],
        title: "Undo / Redo",
        detail:
          "Step backwards through edits or bring them back. The toolbars have matching buttons.",
        target: 'button[aria-label="Undo"]',
        tour: "Made a mistake? Undo steps back through your edits, Redo brings them back.",
      },
      {
        keys: ["⌘0"],
        title: "Fit view",
        detail: "Zoom and center the whole drawing in the canvas.",
        target: 'button[aria-label="Fit view"]',
      },
      {
        keys: ["C"],
        title: "Recenter",
        detail: "Center the canvas on the current selection without changing zoom.",
        target: 'button[aria-label="Recenter"]',
      },
      {
        keys: ["\\"],
        title: "Focus mode",
        detail:
          "Hide the side panels so only the artwork and canvas remain. Press again to restore.",
        target: 'button[aria-label="Focus mode"]',
      },
      {
        keys: ["⇧?"],
        title: "Keyboard shortcuts",
        detail: "Open the full shortcut reference for this screen. Escape closes it.",
        target: 'button[aria-label="Keyboard shortcuts"]',
        tour: "Stuck? Press Shift+? anywhere to see every shortcut available on this screen.",
      },
      {
        keys: ["⌘D"],
        title: "Duplicate",
        detail: "Copy the selection in place, slightly offset from the original.",
        target: 'button[title^="Copy the selection"]',
      },
      {
        keys: ["Del"],
        title: "Delete",
        detail: "Remove the selection. Undo brings it straight back.",
        target: 'button[title^="Remove the selected objects"]',
      },
    ],
  },
  {
    slug: "inspect",
    name: "Social Inspect",
    summary: "See how a URL looks when shared.",
    whatItIs:
      "Paste a URL and get a report of the exact Open Graph tags, Twitter card fields, favicon and preview images that social apps and chat clients use when someone shares it.",
    goodFor: [
      "Checking a share card before you ship a page",
      "Finding a missing or wrong og:image",
      "Comparing how the same URL renders across previews",
      "Grabbing a favicon or social image for reuse in the project",
    ],
    notGoodFor: [
      "Full SEO audits or ranking advice",
      "Sites behind a login or paywall",
      "Screenshotting layouts — use Screenshot Studio for that",
      "Pages that need JavaScript to render their meta tags",
    ],
    features: [
      "The URL is saved in the project document, so reopening the tool restores it.",
      "Tabs separate the raw tag list from the rendered previews.",
      "Example URLs are one click away when you have nothing to paste.",
      "Found images can be added to the project's shared asset library.",
    ],
    workflows: [
      {
        title: "Check a share card before you publish",
        summary: "See exactly what people will see when the link is pasted into an app.",
        steps: [
          {
            title: "Paste the address",
            detail:
              "Press / to jump into the URL field, paste the address and press Enter (or click Inspect).",
          },
          {
            title: "Look at the rendered previews",
            detail:
              "Open the preview tabs to see the card as Slack, X, iMessage and search results would show it.",
          },
          {
            title: "Verify the raw fields",
            detail:
              "Switch to the tag view and check og:title, og:description and og:image. This is where a missing image shows up first.",
          },
          {
            title: "Fix the source and re-run",
            detail:
              "Change the meta tags on the actual page, then inspect the same URL again. Cached previews can take a moment to refresh.",
          },
          {
            title: "Reuse anything useful",
            detail:
              "Click a found image to preview it larger and add it to this project's shared asset library.",
          },
        ],
      },
      {
        title: "Try a known-good example",
        summary: "Learn the report layout without needing a URL of your own.",
        steps: [
          {
            title: "Pick an example",
            detail:
              "Click one of the sample addresses under the input — a live site, GitHub, or a localhost address.",
          },
          {
            title: "Read the status line",
            detail:
              "The report shows which checks passed and failed, so you can see what a healthy result looks like.",
          },
          {
            title: "Compare with your own URL",
            detail:
              "Inspect your page next and use the example as the reference for what should be present.",
          },
        ],
      },
    ],
    controls: [
      {
        keys: ["/"],
        title: "Focus URL field",
        detail: "Jump straight to the address input without touching the mouse.",
        target: 'input[aria-label="URL to inspect"]',
        tour: "Press / to focus the URL field, then paste any address you want to check.",
      },
      {
        keys: ["Enter"],
        title: "Inspect",
        detail: "Run the inspection on the address currently in the field.",
        target: 'button[data-tour="inspect-button"]',
        tour: "Hit Inspect (or Enter) to fetch and parse the page's share metadata.",
      },
      {
        keys: ["Click"],
        title: "Example URLs",
        detail: "Try a ready-made address to see the report format instantly.",
        target: 'button[data-tour="sample-url"]',
        tour: "No URL handy? These examples run an inspection with one click.",
      },
      {
        keys: ["Tab"],
        title: "Preview tabs",
        detail: "Switch between the rendered social cards and the underlying field values.",
        target: '.inspect-tabs [role="tab"]',
        tour: "Tabs let you move between the visual preview and the raw metadata.",
      },
      {
        keys: ["Click"],
        title: "Open a found image",
        detail: "Click an image in the report to preview it larger or save it to the project.",
        target: ".inspect-report img",
        tour: "Images found on the page can be previewed and reused in this project.",
      },
      {
        keys: ["Click"],
        title: "Change the address",
        detail: "The tool header's Inspect URL button returns focus to the input at any time.",
        target: 'button[aria-label="Inspect URL"]',
      },
      {
        keys: ["Esc"],
        title: "Close overlays",
        detail: "Escape dismisses dialogs and the shortcut list without losing your report.",
      },
      {
        keys: ["⇧?"],
        title: "Keyboard shortcuts",
        detail: "Open the shortcut reference for the current screen.",
      },
      {
        keys: ["Ctrl B"],
        title: "Toggle sidebar",
        detail: "Collapse the navigation to give the report more room.",
      },
      {
        keys: ["Back"],
        title: "Return to the project",
        detail:
          "Use the project switcher in the sidebar to move to another project or back to the dashboard.",
      },
    ],
  },
  {
    slug: "brand",
    name: "Brand Assets",
    summary: "Generate a brand kit from one source mark.",
    whatItIs:
      "Give it a logo and it produces a consistent set of brand files: favicons, an app icon, a social sharing card and a web manifest, all derived from the same artwork and colors.",
    goodFor: [
      "Turning one logo into a coherent favicon and icon set",
      "Building an Open Graph card that matches your brand",
      "Keeping a project's brand files in one place",
      "Handing a repeatable recipe to an MCP agent",
    ],
    notGoodFor: [
      "Designing a logo from scratch — bring a source mark",
      "Full brand guidelines documents",
      "Photographic or highly textured artwork",
      "Legal trademark checks",
    ],
    features: [
      "The source artwork stays in the project and can be swapped without redoing the form.",
      "Outputs are editable tool documents — reopen the tool to change colors and regenerate.",
      "The visual editor lets you drag layers, use templates and save your own as a global template.",
      "Custom social-card designs are stored as project assets and reused on regeneration.",
      "The same generation is available to agents through MCP.",
    ],
    workflows: [
      {
        title: "Build a complete kit from one logo",
        summary: "One source mark becomes every file a web app usually needs.",
        steps: [
          {
            title: "Choose the source mark",
            detail:
              "Click Choose and pick a transparent SVG or PNG from your files. It is stored in this project so other tools can use it.",
          },
          {
            title: "Set the brand colours",
            detail:
              "Fill the plate, theme and background colours. Use the pickers or type hex values — the preview updates as you go.",
          },
          {
            title: "Fine-tune the social card",
            detail:
              "Open the visual editor. Drag layers into place, try a template, or save your layout as a global template for later projects.",
          },
          {
            title: "Generate the set",
            detail:
              "Click Generate. Favicons, the app icon, the social card and the web manifest are written into the project asset library.",
          },
          {
            title: "Check the outputs",
            detail:
              "Click any generated preview to open it in the zoomable gallery, then use Copy config to take the manifest into your app.",
          },
        ],
      },
      {
        title: "Reuse a design in another project",
        summary: "Keep a card look you like without rebuilding it.",
        steps: [
          {
            title: "Save the design",
            detail:
              "In the visual editor, choose Save as template and give it a name. The design is stored globally, not just in this project.",
          },
          {
            title: "Switch projects",
            detail: "Use the project switcher in the sidebar and open Brand Assets there.",
          },
          {
            title: "Apply the template",
            detail:
              "Open the template gallery in the editor and apply the saved design. Your new project's mark and colours fill it in.",
          },
        ],
      },
    ],
    controls: [
      {
        keys: ["Click"],
        title: "Choose source artwork",
        detail:
          "Pick the logo or mark this kit is built from. It is stored in the project for other tools.",
        target: 'button[data-tour="choose-source"]',
        tour: "Start here — choose the source logo. Everything else is derived from it.",
      },
      {
        keys: ["Click"],
        title: "Generate",
        detail:
          "Run the generator with the current form values. Results are added to the project library.",
        target: 'button[data-tour="generate"]',
        tour: "Generate writes the finished files into this project's shared asset library.",
      },
      {
        keys: ["Click"],
        title: "Reset",
        detail: "Put every field back to its default values without deleting generated files.",
        target: 'button[title="Reset all fields to defaults"]',
      },
      {
        keys: ["Click"],
        title: "Open visual editor",
        detail: "Edit the social card visually: move layers, change colors and apply templates.",
        target: 'button[aria-label="Open visual editor"]',
        tour: "The visual editor is where you fine-tune the social card instead of guessing values.",
      },
      {
        keys: ["Click"],
        title: "Customize social card",
        detail: "Open the card editor directly from its preview.",
        target: 'button[aria-label="Customize social card"]',
      },
      {
        keys: ["Click"],
        title: "Plate color",
        detail: "Set the background plate behind your mark. Use the picker or type a hex value.",
        target: 'input[aria-label="Plate color hex value"]',
      },
      {
        keys: ["Click"],
        title: "Theme color",
        detail: "The accent used across the generated card and previews.",
        target: 'input[aria-label="Theme hex value"]',
      },
      {
        keys: ["Click"],
        title: "Background color",
        detail: "The card's main background, independent of the plate.",
        target: 'input[aria-label="Background hex value"]',
      },
      {
        keys: ["Select"],
        title: "Card layout",
        detail: "Choose between standalone, fullscreen, minimal UI and browser preview layouts.",
        target: 'select[data-tour="card-layout"]',
      },
      {
        keys: ["Click"],
        title: "Save as template",
        detail: "In the visual editor, save your card design globally so any project can apply it.",
        tour: "Designs you like can be saved as templates and reused in other projects.",
      },
      {
        keys: ["Click"],
        title: "Copy prompt or config",
        detail: "Copy the exact prompt or generated config for use elsewhere or with an agent.",
      },
      {
        keys: ["⇧?"],
        title: "Keyboard shortcuts",
        detail: "Open the shortcut reference for the current screen.",
      },
    ],
  },
  {
    slug: "expo",
    name: "Expo Assets",
    summary: "Produce the icons a mobile app needs.",
    whatItIs:
      "Generate the full set of Expo app icons and splash screens from one mark: iOS and Android icons, adaptive icons, notification icons and a splash background, plus the matching app.json config.",
    goodFor: [
      "Creating every required icon size from one source image",
      "Keeping Android adaptive icons consistent with iOS icons",
      "Getting an app.json snippet you can paste into a project",
      "Regenerating assets after a brand color change",
    ],
    notGoodFor: [
      "Building the app itself or editing native projects",
      "Designing a new logo — supply a finished mark",
      "Store listing screenshots — use Screenshot Studio",
      "App Store review or submission",
    ],
    features: [
      "Source artwork is shared with Brand Assets, so you only upload a logo once.",
      "Optional logos can be left empty and generated from the primary mark.",
      "Previews update as you change colors and sizes.",
      "Generated files and the form values are stored as a project document.",
      "Agents can call the same generator through MCP.",
    ],
    workflows: [
      {
        title: "Generate a mobile icon set",
        summary: "From one logo to every size an Expo app asks for.",
        steps: [
          {
            title: "Pick the primary logo",
            detail:
              "Click Change next to the primary artwork. If Brand Assets already has a mark in this project, choose it instead of uploading again.",
          },
          {
            title: "Fill optional variants if needed",
            detail:
              "The dark and tinted splash logos can be left empty — the generator falls back to the primary mark.",
          },
          {
            title: "Set brand and splash colours",
            detail:
              "Choose the icon tint and the background that sits behind the splash logo on both platforms.",
          },
          {
            title: "Generate the assets",
            detail:
              "Click Generate. iOS icons, Android adaptive icons, notification icons and splash screens are added to the project library.",
          },
          {
            title: "Inspect and copy config",
            detail:
              "Click a preview to zoom into its edges, then copy the generated app.json config into your Expo project.",
          },
        ],
      },
      {
        title: "Update icons after a rebrand",
        summary: "Change the inputs once and regenerate everything together.",
        steps: [
          {
            title: "Reopen this tool",
            detail:
              "The form keeps your previous values as an editable project document — nothing is locked in.",
          },
          {
            title: "Swap the mark or colours",
            detail:
              "Change the source artwork or the brand colour. Previews update before you generate.",
          },
          {
            title: "Generate again",
            detail:
              "New files are written to the library; old ones are still there if you need to compare them.",
          },
        ],
      },
    ],
    controls: [
      {
        keys: ["Click"],
        title: "Change source artwork",
        detail: "Swap the primary logo used for every generated icon.",
        target: 'button[data-tour="change-source"]',
        tour: "Pick the primary logo here. All icon sizes are derived from it.",
      },
      {
        keys: ["Click"],
        title: "Generate",
        detail: "Create the icon set and splash screens and add them to the project library.",
        target: 'button[data-tour="generate"]',
        tour: "Generate writes the finished icons and splash screens into this project.",
      },
      {
        keys: ["Click"],
        title: "Reset",
        detail: "Restore the form to its defaults without deleting anything already generated.",
        target: 'button[title="Reset all fields to defaults"]',
      },
      {
        keys: ["Click"],
        title: "Optional logos",
        detail: "Reveal fields for alternate icons. Leaving them empty reuses the primary mark.",
        target: 'button[data-tour="optional-logos"]',
      },
      {
        keys: ["Click"],
        title: "Brand color",
        detail:
          "The main tint used for adaptive and notification icons. Pick visually or enter hex.",
        target: 'input[aria-label="Brand color hex value"]',
      },
      {
        keys: ["Click"],
        title: "Splash background",
        detail: "Background color behind the splash logo on Android and iOS.",
        target: 'input[aria-label="Splash background hex value"]',
      },
      {
        keys: ["Click"],
        title: "Preview a size",
        detail: "Click any generated preview to open it in the zoomable gallery.",
        target: ".expo-preview-card",
        tour: "Previews open in a gallery where you can zoom at the cursor and pan around.",
      },
      {
        keys: ["Click"],
        title: "Copy app.json config",
        detail: "Copy the generated configuration straight into your Expo project.",
      },
      {
        keys: ["Click"],
        title: "Copy prompt",
        detail: "Copy a text prompt that reproduces these settings with an agent.",
      },
      {
        keys: ["⇧?"],
        title: "Keyboard shortcuts",
        detail: "Open the shortcut reference for this screen.",
      },
      {
        keys: ["Ctrl B"],
        title: "Toggle sidebar",
        detail: "Collapse the navigation for more canvas room.",
      },
    ],
  },
  {
    slug: "studio",
    name: "Screenshot Studio",
    summary: "Compose store-ready screenshot boards.",
    whatItIs:
      "A canvas for building the long screenshot strips app stores want. Drop in device frames, add headlines and shapes, then export each scene as a PNG in the sizes the stores expect.",
    goodFor: [
      "App Store and Google Play screenshot strips",
      "Showing one flow across several device sizes",
      "Reusing a board layout for a future release",
      "Quick annotated mockups from imported screenshots",
    ],
    notGoodFor: [
      "Recording video or animated previews",
      "Highly detailed illustration work",
      "Writing marketing copy — bring your own text",
      "Editing the screenshots themselves; edit the source image first",
    ],
    features: [
      "Boards and their layers are saved per project and persist between sessions.",
      "Whole boards can be saved as global templates and applied in any project.",
      "Device presets cover phones, tablets, foldables and desktops from both stores.",
      "The asset drawer previews images with zoom and arrow-key navigation.",
      "Wheel zooms toward the cursor and dragging pans the canvas.",
      "Store rules can be applied to keep slices within platform requirements.",
    ],
    workflows: [
      {
        title: "Build one store-ready strip",
        summary:
          "A device frame on the board is the final output: its bounds are the image the store will show.",
        steps: [
          {
            title: "Choose a scene size",
            detail:
              "Pick phone, tall phone or tablet for the strip. This sets the size of every slice inside it.",
          },
          {
            title: "Add the scenes you need",
            detail:
              "Use + to add a slice for each step of your story. A strip can contain several subsections, and each one exports as its own image.",
          },
          {
            title: "Place your screenshots",
            detail:
              "Open Assets, import a screenshot, then click it to place it on the board or onto a selected device.",
          },
          {
            title: "Add and tilt devices",
            detail:
              "Drop in more device frames, rotate them and arrange several across a single strip. Foldables, desktops and browser windows are all available.",
          },
          {
            title: "Label the story",
            detail:
              "Add a headline, subtext, lines and shapes from the element menu to explain what each scene is showing.",
          },
          {
            title: "Export and read the guides",
            detail:
              "Click Export board. The dotted lines on the canvas mark exactly where each portrait image lands in the exported file.",
          },
        ],
      },
      {
        title: "Make a different board per platform",
        summary: "iOS and Android often need different device mixes and different moods.",
        steps: [
          {
            title: "Save the board you like",
            detail:
              "Use Save board as template in the header and name it. The whole layout is stored globally.",
          },
          {
            title: "Create a second board",
            detail: "Start another board for iOS with its own device set and copy style.",
          },
          {
            title: "Build an Android / large-screen board",
            detail:
              "Use the foldable, tablet and desktop presets — Google Play increasingly expects large-screen support.",
          },
          {
            title: "Reuse the layout elsewhere",
            detail:
              "Open Browse board templates in any project and apply your saved template to start from the same composition.",
          },
        ],
      },
      {
        title: "Keep the canvas under control",
        summary: "Small habits that make composing a strip much faster.",
        steps: [
          {
            title: "Fit everything with 0",
            detail: "Press 0 or click Recenter board to see every strip at once after zooming in.",
          },
          {
            title: "Zoom toward what matters",
            detail:
              "Scroll to zoom at the pointer and drag the canvas to pan. This works all the way to the edges of the board.",
          },
          {
            title: "Undo freely",
            detail: "Ctrl Z steps back through changes; the History panel shows the full sequence.",
          },
          {
            title: "Apply store rules before exporting",
            detail:
              "Use the App Store or Google Play presets to check the strip against each platform's requirements.",
          },
        ],
      },
    ],
    controls: [
      {
        keys: ["Click"],
        title: "Board name",
        detail: "Rename the board. The name follows the exported files.",
        target: 'input[aria-label="Board name"]',
      },
      {
        keys: ["Click"],
        title: "Scene strip name",
        detail: "Name the current strip so exports are easy to identify.",
        target: 'input[data-testid="header-strip-name"]',
      },
      {
        keys: ["0"],
        title: "Recenter board",
        detail: "Fit every scene strip into the current view.",
        target: 'button[data-testid="recenter-board"]',
        tour: "Press 0 or use Recenter to fit the whole board back into view.",
      },
      {
        keys: ["Click"],
        title: "Scene size",
        detail: "Pick the device class for this strip: phone, tall phone or tablet.",
        target: 'select[aria-label="Scene size"]',
      },
      {
        keys: ["+ / −"],
        title: "Add or remove slices",
        detail: "Change how many scenes this strip contains.",
        target: 'button[title="Remove the last slice"]',
      },
      {
        keys: ["Click"],
        title: "Assets",
        detail: "Open the asset drawer to import images and place them on the board or a slice.",
        target: 'button[aria-label="Open assets"]',
        tour: "Import screenshots here, then click one to place it on a slice or a device.",
      },
      {
        keys: ["["],
        title: "Toggle library",
        detail: "Hide or show the left-hand library panel.",
        target: 'button[aria-label="Hide library ([)"]',
      },
      {
        keys: ["]"],
        title: "Toggle inspector",
        detail: "Hide or show the properties panel on the right.",
        target: 'button[aria-label="Hide inspector (])"]',
      },
      {
        keys: ["Ctrl Z"],
        title: "Undo",
        detail: "Step back through board changes. History is also available as a panel.",
        target: 'button[aria-label="Undo last change"]',
      },
      {
        keys: ["Click"],
        title: "Save board as template",
        detail: "Name and save the whole board globally so any project can reuse it.",
        target: 'button[aria-label="Save board as template"]',
        tour: "Like this layout? Save the whole board as a template for future projects.",
      },
      {
        keys: ["Click"],
        title: "Browse templates",
        detail: "Open the template library to apply or delete saved boards.",
        target: 'button[aria-label="Browse board templates"]',
      },
      {
        keys: ["Click"],
        title: "Export board",
        detail: "Download every slice in the board as a set of PNGs.",
        target: 'button[data-testid="export-board"]',
        tour: "Export produces one PNG per scene, ready for the store listing.",
      },
      {
        keys: ["Wheel", "Drag"],
        title: "Zoom and pan",
        detail: "Scroll to zoom toward the pointer; drag the canvas to pan around it.",
        target: '[data-testid="recenter-canvas"]',
        tour: "Scroll to zoom where your cursor is, and drag to pan around the board.",
      },
    ],
  },
  {
    slug: "sound",
    name: "Cabra Sound",
    summary: "Find and export UI sounds.",
    whatItIs:
      "A searchable library of short interface sounds — clicks, taps, transitions and notifications. Preview anything instantly, favorite the ones you like and download them as WAV files.",
    goodFor: [
      "Finding a click, tap or transition quickly",
      "Building a shortlist of sounds for a project",
      "Exporting ready-to-use WAV files",
      "Mixing a few sounds into a single file",
    ],
    notGoodFor: [
      "Composing music or long-form audio",
      "Editing waveform details — use a DAW",
      "Voice recording or speech synthesis",
      "Mastering for distribution",
    ],
    features: [
      "Favorites float to the top and are stored per project.",
      "The search box filters by sound name as you type.",
      "Mix combines selected sounds into one WAV.",
      "The WAVs view shows only sounds that have been exported.",
      "Press / from anywhere in the tool to start searching.",
    ],
    workflows: [
      {
        title: "Find the right sound",
        summary: "From a vague idea to a file you can drop into a project.",
        steps: [
          {
            title: "Focus the search",
            detail:
              "Press / anywhere in the tool, then type what you are looking for — a name like 'click' or a quality like 'soft'.",
          },
          {
            title: "Preview candidates",
            detail:
              "Click a result to hear it immediately. Keep trying until one fits the rhythm of your interface.",
          },
          {
            title: "Star the keepers",
            detail:
              "Click the star on a sound. Favorites rise to the top of the list and are saved for this project.",
          },
          {
            title: "Export one or mix several",
            detail:
              "Download a single sound as WAV, or select a few and choose Mix to combine them into one file.",
          },
          {
            title: "Check what you exported",
            detail:
              "Use WAVs to show only the sounds you have exported in this project, so you can see what is ready to use.",
          },
        ],
      },
      {
        title: "Build a shortlist for a project",
        summary: "Keep a consistent set of interface sounds together.",
        steps: [
          {
            title: "Search by purpose",
            detail:
              "Work through the sounds you need — a tap, a success chime, a transition — and preview each one.",
          },
          {
            title: "Star as you go",
            detail:
              "Every starred sound floats upward, so your shortlist stays at the top even after new searches.",
          },
          {
            title: "Export the set",
            detail:
              "Choose WAVs to export each starred sound, or Mix to render them as one combined file.",
          },
        ],
      },
    ],
    controls: [
      {
        keys: ["/"],
        title: "Search sounds",
        detail: "Focus the search field and type to filter the library by name.",
        target: 'input[placeholder^="Search"]',
        tour: "Press / then type to filter the library without touching the mouse.",
      },
      {
        keys: ["Click"],
        title: "Play a sound",
        detail: "Click a sound row to hear it immediately.",
        target: 'button[data-tour="sound-pad"]',
        tour: "Click any sound to preview it right away.",
      },
      {
        keys: ["Click"],
        title: "Favorite",
        detail: "Star a sound so it rises to the top of the list for this project.",
        target: 'button[aria-label^="Favorite "]',
        tour: "Star the sounds you like — favorites float to the top and stay with this project.",
      },
      {
        keys: ["Click"],
        title: "Download as WAV",
        detail: "Export a single sound as a WAV file.",
        target: 'button[aria-label^="Download "]',
      },
      {
        keys: ["Click"],
        title: "Mute",
        detail: "Silence previews without leaving the tool.",
        target: 'button[aria-label="Mute sounds"]',
      },
      {
        keys: ["Click"],
        title: "Mix",
        detail: "Combine selected sounds into a single WAV.",
        target: 'button[data-tour="mix-tab"]',
      },
      {
        keys: ["Click"],
        title: "WAVs",
        detail: "Show only sounds that have been exported in this project.",
        target: 'button[data-tour="wavs-tab"]',
      },
      {
        keys: ["Click"],
        title: "Random",
        detail: "Play a surprise sound from the library — handy for finding something new.",
        target: 'button[data-tour="random-tab"]',
      },
      {
        keys: ["Esc"],
        title: "Clear the search",
        detail: "Escape clears the current filter and restores the full list.",
      },
      {
        keys: ["⇧?"],
        title: "Keyboard shortcuts",
        detail: "Open the shortcut reference for this screen.",
      },
    ],
  },
];

export interface QuickStart {
  slug: string;
  workflow: number;
}

export const QUICK_STARTS: QuickStart[] = [
  { slug: "compose", workflow: 0 },
  { slug: "brand", workflow: 0 },
  { slug: "studio", workflow: 0 },
  { slug: "inspect", workflow: 0 },
  { slug: "expo", workflow: 0 },
  { slug: "sound", workflow: 0 },
];

export const HELP_TOOL_PACKAGES: Record<string, string> = {
  compose: "svg-compose",
  inspect: "social-inspect",
  brand: "brand-assets",
  expo: "expo-assets",
  studio: "screenshot-studio",
  sound: "cabra-sound",
};

export function getHelpGuide(slug: string): HelpGuide | undefined {
  return HELP_GUIDES.find((guide) => guide.slug === slug);
}

export function searchHelpControl(control: HelpControl, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [control.title, control.detail, ...control.keys].join(" ").toLowerCase().includes(needle);
}

export function searchHelpGuide(guide: HelpGuide, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    guide.name,
    guide.summary,
    guide.whatItIs,
    ...guide.features,
    ...guide.goodFor,
    ...guide.workflows.flatMap((workflow) => [
      workflow.title,
      workflow.summary,
      ...workflow.steps.flatMap((step) => [step.title, step.detail]),
    ]),
    ...guide.controls.flatMap((control) => [control.title, control.detail, ...control.keys]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function tourStepsFor(guide: HelpGuide): TourStep[] {
  const steps: TourStep[] = [
    {
      id: `${guide.slug}-intro`,
      title: `Welcome to ${guide.name}`,
      content: guide.whatItIs,
      target: "body",
      placement: "center",
    },
  ];
  let index = 0;
  for (const control of guide.controls) {
    index += 1;
    steps.push({
      id: `${guide.slug}-${index}`,
      title: `${control.title}${control.keys.length ? ` · ${control.keys.join(" / ")}` : ""}`,
      content: control.tour ?? control.detail,
      target: control.target ?? "body",
      placement: control.target ? "bottom" : "center",
    });
  }
  return steps;
}
