# UO · Scenario Branches

## What it is for

A branching campaign usually lives in the GM's head or in a notebook: "if they spare the baron, peace follows; if they execute him, war." While there are three branches, that works. By the tenth, the GM no longer remembers which endings the party cut off back in act two and which are still alive.

The module keeps the scenario as a blueprint: nodes, arrows between them, marks recording what happened in the world, and endings. The GM ticks off what has come to pass — and sees which endings are still in play and which the party closed with its own hands.

Only GMs see the graph. This is the kitchen, not the table.

## A scenario is a journal

The scenario does not live inside the module. A scenario is an ordinary Foundry journal, and a node is one of its pages.

That was done for portability. A node's text is written with the standard editor, links to scenes, actors and items work by themselves, permissions are handed out as always, and a finished scenario goes into a compendium and travels to another GM whole — prose and all. The module adds only the connections: arrows, marks and the campaign's progress live in its flags.

Remove the module and what is left is a journal with pages, not rubbish.

There are two ways in:

- the **"Branches"** button in the header of the journals sidebar — a list of scenarios and "New scenario";
- right-click any journal — **"Branches: make it a scenario"**. A journal already written turns into a graph: the nodes lay themselves out, and all that is left is to draw the arrows.

## Nodes, arrows, canvas

The canvas is dragged by empty space and zooms with the wheel. A card is dragged by itself and remembers its place — which is stored in the page, not in the module.

- **Node** — the button in the panel. A new node appears in the middle of the visible canvas.
- **Arrow** — select a node, press "Arrow", then click the one it leads to. Escape, or a second click on the same node, cancels.
- **Text** — opens the journal page: that is where the scene itself is written.
- **Lay out** — arranges every card in layers (a layer is the distance from the start). Useful after turning an old journal into a scenario; note that anything you placed by hand is lost.

## The kind of a node is not decoration

Four kinds, and the difference between them is more than a symbol:

- **◆ Scene** — you can come back to it. The party left a hook in act one and returned to it a month later: that is ordinary play, and nothing closes.
- **◇ Fork** — a choice made once. As soon as one of its exits has been taken, **the rest close for good** — even if some roundabout road leads back to the fork. The baron was executed, so the branch where he is spared is gone.
- **★ Ending** — the outcome of the campaign. Endings are what the panel counts.
- **✚ Reserve** — a scene up your sleeve. The rescue that pulls the party out of a hopeless fight; the help that arrives when there is no way without it. **No arrows lead to a reserve node**: it happens not because the party walked there but because the GM decided so. On the canvas it has a dotted border, and without saved positions it is laid out in its own lane below the scenario.

Without the fork rule the count would be empty: there is nearly always a roundabout road to any node, and "cut off" would never fire. By choosing a kind, the author tells the module what can be returned to.

**Spending a reserve.** When the GM plays it, tick the node as **passed**, like any other. Its marks are set and the arrows leaving it open. A spent reserve stays passed, so it is plain that this rescue has already been used. It helps to gather reserves into one branch — "Rescues" — so they read as a group on the canvas.

For the ending count an unspent reserve is **always available**: the GM can play it at any moment. So an ending reachable only through a reserve rescue is never called cut off. The scheme does not know conditions like "only before meeting the master" — this is the same estimate from above as with marks below.

## Campaign marks

A mark is a short fact about the world: "the baron lives", "the seal is broken", "the guild knows the name". Marks are set up in the panel and live at two ends:

- **a node sets and clears marks** — when a node is ticked as having happened, its marks are applied by themselves;
- **an arrow requires marks** — it is open when every required mark is set and no blocking mark is.

A mark can also be flipped by hand, with a checkbox in the panel. That is deliberate: anything can happen at the table, and the GM must be able to say "no, the baron survived after all" without rewriting the scenario.

Un-ticking a node does not undo its marks. A clever undo would lie: the same mark could have been set by another node too, and "undo" would erase somebody else's trace.

## Endings: what is still possible, what is cut off

In the panel every ending carries one of three labels:

- **reached** — the campaign arrived there;
- **still possible** — there is a road to it from what has already been played;
- **cut off** — there is no road.

This is not counted by eye. The module grows two sets at once: a reachable node adds its marks, a new mark opens arrows, arrows add nodes — and so on while they grow. Whatever is left outside is unreachable.

**On honesty.** While marks only accumulate, the count is exact. But a node can also clear a mark — "the baron died" cancels "the baron owes a favour". With retractions the problem stops being exact, and the module counts **from above**: a node declared cut off is cut off for certain, while "still possible" means "given a lucky turn". The opposite promise would be a lie, so it is not made.

## Reviewing what was written

The **"Check"** button reads the scenario as an editor would, not as a player, and says what does not add up:

- no start is set;
- nodes nothing leads to (orphans) — reserve nodes are not listed, nor what lies beyond them;
- dead ends not marked as endings — except reserves: a rescue may lead nowhere further;
- endings that have a way out;
- reserve nodes that arrows lead into — perhaps they are ordinary scenes;
- marks that are required somewhere but that no node sets;
- arrows leading nowhere.

These are remarks, not prohibitions. A scenario with a dangling node still plays — the author usually just wants to know.

## Several parties on one scenario

One world, two groups, one blueprint. The scheme is shared; the progress belongs to each party.

**What is shared.** Nodes, arrows, marks, branches, the start. Add a node and it appears for every party at once — that is the point: the scenario is written once.

**What is each party's own.** What has happened, what happened partly, which marks are raised, and the remarks on nodes. That is exactly what tells the parties apart.

**Switching.** The "Party" section comes first in the panel, one button per party. The current party's name is also in the window title: marking the wrong group's progress is easy, and noticing it later is not.

**Who stands where.** Under the buttons, one line per other party: how many nodes they passed and which endings they reached. On the cards themselves stand coloured dots of the parties that have already been there — filled means passed, hollow means passed partly. So you can see that the first group has already taken the ending the second is still walking towards.

**Splitting.** The "Split" button creates a party that inherits the current one's progress: half the players went their own way from the same place. From there the two diverge.

**A note on the roster.** The party settings have a "Who plays" field. Two groups in one world get confused by roster, not by name: "the ones with the dryad" comes to mind faster than a title.

A party is created by itself when the graph is first opened. A scenario that was run before this existed hands its progress to the first party — what was passed, the marks and the remarks all stay where they were.

## Starting over

The **"Start over"** button forgets what has happened and clears the marks **of one party** — the one currently selected; its name is on the button itself. The scenario and the other parties stay intact.

A party can be removed in the same "Party" section. The last one cannot: its progress is all the progress there is, and a graph without a party would show emptiness.

## From macros

```js
UOVetvi.panel()                       // the list of scenarios
UOVetvi.open("The Siege of Vardein")  // open the graph by journal name
UOVetvi.create("New scenario")        // create one
UOVetvi.list                          // what exists in this world
UOVetvi.endings("The Siege")          // endings: reached / possible / cut off
UOVetvi.check("The Siege")            // review of what was written

UOVetvi.parties.list("The Siege")            // the parties of a scenario
UOVetvi.parties.current("The Siege")         // whose progress is being written
UOVetvi.parties.switch("The Siege", id)      // switch
UOVetvi.parties.add("The Siege", "Saturdays")
UOVetvi.parties.split("The Siege", id, "Fridays")   // inherit the progress
```

`endings` and `sum` take a second argument, a party id; without it the current one is used.

## Language

Russian in the source, English through the `lang/en.json` dictionary. Which one is used is decided by the **"Module language"** setting — each participant has their own: **"Same as Foundry"** (the default: Russian if Foundry is in Russian, English for any other language), **"Русский"** or **"English"**. So Foundry can run in English while the module speaks Russian, and the other way round. Changing it reloads the world.

## Updating a scenario without losing progress

A scenario built from sources arrives in the world by dragging it out of the compendium: arrows, labels and node kinds travel with the journal.

But **you cannot update it by dragging**. Dragging always creates a new copy: you get a second journal with a clean slate, while all the progress stays in the first one — along with the outdated arrows.

For that there is right-click on the journal → **"Branches: update from compendium"**. The journal stays the same, the scheme arrives fresh, and marked nodes and raised campaign labels are left alone: they live in a separate flag.

The dialog has two checkboxes. **Update page text as well** is on: scenarios are usually edited in the source, not in the world; if you did edit in the world, turn it off or those edits are overwritten. **Remove pages missing from the source** is off: a page may have been dropped from the scenario, or it may be your own note in the margin. The module reports any that remain.

If Foundry did not record where the journal came from — as happens with journals imported long ago — the module looks for journals of the same name in the packs and asks which one it is. Do not answer at random: a namesake from elsewhere would overwrite the scheme with someone else's arrows.

## Three states of a node

**Did not happen · Partly · Happened** — three buttons in the panel, and the same in the right-click menu.

**Happened** — the node is passed and its labels are raised.

**Partly** — the event has begun but not ended: the party found the book but has not read it yet. Labels are **not** raised: there are no consequences yet. There is no need for a separate node for every such step — the scheme would swell for nothing.

**Did not happen** — the node returns to its initial state, and the labels it raised go down by themselves. They used to need putting out by hand, remembering which came from which node; now labels are recomputed from everything that has been passed.

A label tied to no node stays yours: the recomputation never touches it, raise and lower it by hand.

## A note on a node

The "Note…" button, or right-click on the node. A couple of lines about how it ended and what is left: "found it but have not read it", "the bargain holds until the full moon". A ✎ appears on the node, and the text shows on hover.

The note lives in the campaign's progress, not in the scenario: send the scenario to another GM and the notes stay with you.

## Branches and colours

A **branch** is a strand of the scenario named out loud: "the undersea", "the armourers", "the call of the Abyss". Nodes of one branch share a colour — a stripe down the left side.

A branch is for the eye only. It affects no rules, and a node of one branch may lead into another: a strand is a storyteller's notion, not a mechanism, and forbidding such crossings would lie about how the scenario works.

Branches are created in the panel with "New branch"; a node is assigned one in its settings. Remove a branch at any time — the nodes stay, they just lose their colour.

## The mouse on the canvas

**Double-click** a node to open its page in the journal — the commonest action at the table.

**Right-click** opens a menu on the node itself: page, note, the three states, settings, arrow, start here, remove.

Left-click still selects a node, dragging moves it, the wheel zooms the canvas.
