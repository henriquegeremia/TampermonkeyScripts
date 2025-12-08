# Development Pipeline with Agent

This document outlines the development pipeline established during interactions with the agent, ensuring a consistent and efficient approach to implementing new requirements and addressing issues.

## 1. Understand & Plan

-   **Requirement Analysis**: Carefully understand the user's request, breaking down complex tasks into smaller, manageable subtasks.
-   **Contextual Review**: Analyze existing code, tests, configuration, and project conventions to ensure changes integrate naturally and idiomatically.
-   **Subtask Tracking**: Utilize the `write_todos` tool to list and track subtasks, marking them as `pending`, `in_progress`, `completed`, or `cancelled` as work progresses.

## 2. Iterative Implementation

Each subtask, or logical group of changes, follows an iterative cycle:

### a. Version Management

-   **Version Increment**: Before making any code changes for a new feature or fix, increment the script's version number. This involves:
    -   Updating the `version` field in the `CONFIG` object.
    -   Updating the `@version` tag in the Userscript header.
-   **GUI Visibility**: Ensure the updated version is reflected and visible in the script's Graphical User Interface (GUI), as established in previous discussions.

### b. Code Modification

-   **Implement Changes**: Apply the necessary code modifications according to the current subtask.
-   **Adhere to Conventions**: Strictly follow existing project conventions (formatting, naming, style, architectural patterns).
-   **Use Tools**: Employ available tools like `replace` for targeted code changes or `write_file` for new files.

### c. Debugging & Verification

-   **Extensive Logging**: For complex features or bug fixes, especially those related to UI interaction or dynamic page content, use `console.log` extensively to trace execution, variable states, and element properties.
-   **User Feedback**: Request the user to test the changes and provide console output. This feedback is critical for diagnosing issues that the agent cannot directly observe.

### d. Version Control & Synchronization

-   **Commit Changes**: After each logical set of changes (e.g., implementing a subtask, fixing a bug, adding debug logs), stage the modified files and commit them with a descriptive message.
    -   **Commit Message Convention**: Use conventional commits (e.g., `feat:`, `fix:`, `refactor:`, `debug:`, `chore:`) to clearly categorize the change.
-   **Push to Remote**: Immediately push the local commits to the remote repository to synchronize changes and make them available for user testing. This ensures the user always tests the latest version.

### e. User Testing & Feedback

-   **Instruction**: Clearly instruct the user on how to test the new functionality or verify the fix.
-   **Console Output Request**: Explicitly ask for console logs and detailed descriptions of the user's experience to facilitate further debugging or refinement.

## 3. Continuous Improvement

-   The agent will continuously refine this pipeline based on user feedback and observed efficiency, always prioritizing clear communication and effective problem-solving.
