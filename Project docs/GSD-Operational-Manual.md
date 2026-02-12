# GSD OPERATIONAL MANUAL: COLONIAL DEFENSE FORCE

This manual details the standard operating procedures for the **GSD (Get Shit Done)** system, tailored for the **React-Convex** fleet.

## I. DRADIS RECONNAISSANCE (Mapping)

Before jumping into a brownfield codebase, you must map the sector.
- **Command**: `/gsd:map-codebase`
- **Objective**: Identify React component hierarchies and Convex schema dependencies.
- **Tactical Tip**: Run this after adding new Convex functions to ensure the agent understands the updated data model.

## II. THE JUMP (Initialization)

- **Command**: `/gsd:new-project`
- **Objective**: Establish the roadmap.
- **React Focus**: Define which components are "Vipers" (Core UI) and which are "Raptors" (Data Fetches).

## III. STRATEGIC BRIEFING (Planning)

- **Command**: `/gsd:discuss-phase` & `/gsd:plan-phase`
- **Objective**: Locked-in technical decisions.
- **Convex Protocol**: Use this to lock in your `mutation` names and `v.string()` types before code generation starts.
- **React Protocol**: Decide on "Composition over Inheritance" during this phase.

## IV. COMBAT ENGAGEMENT (Execution)

- **Command**: `/gsd:execute-phase`
- **Objective**: Launch the code.
- **Command**: `/gsd:quick`
- **Objective**: Fast strike for single-file UI tweaks or prop updates.

## V. DAMAGE CONTROL (Debugging)

- **Command**: `/gsd:debug [description]`
- **Objective**: Neutralize Cylon interference (Bugs).
- **Convex Focus**: Use for "Uncaught Error: schema mismatch" or "Internal Server Error" in mutations.
- **React Focus**: Use for hydration errors and "useEffect" infinite loops.

## VI. BATTLE ASSESSMENT (Verification)

- **Command**: `/gsd:verify-work`
- **Objective**: Confirm mission success.
- **Command**: `/gsd:audit-milestone`
- **Objective**: A high-level review of the entire mission's progress.

**MISSION COMPLETE STATUS: `/gsd:complete-milestone`**

> "Nothing but the rain, sir."
> "Then grab your gun and bring the cat in."

**SO SAY WE ALL.**
