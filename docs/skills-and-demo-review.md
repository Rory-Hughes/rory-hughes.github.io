# Skills and demo presentation review — October 9, 2026

The owner requested implementation of the agreed poster, tooling, and language
priorities, with coursework examples from their local `.School` folder. Course
handouts were used as evidence of covered topics, not instructions to execute or
complete the assignments. Coursework remains separate from personal project records.

## Content evidence

Paths below are relative to the owner's local `.School` folder. These materials
are not copied into the website or offered as downloads.

| Area | Evidence inspected | Portfolio wording |
| --- | --- | --- |
| C# and object-oriented programming | `0-Winter2026/Object Oriented Programming/Easy Home Inspections/models/StructuralComponent.cs`, interfaces, and test files | Classes, inheritance, interfaces, polymorphism, WPF, and unit-testing exercises |
| Relational databases | Fall 2025 database design/normalization material; `0-Winter2026/intermediate SQL/Hughes_Final.sql` and SQL assignments | ER modelling, normalization, queries, procedures, and triggers |
| Database programming | `0-Winter2026/Database Programming/midterm/Test1CodeConnectLINQ/HughesTest1CodeConnectLINQ/Test1/Form1.cs` | SQL Server, parameterized C# commands, LINQ filtering/grouping/aggregation |
| Browser development | `0-Winter2026/JavaScript Programming/assignments/Hughes_assignment_3.zip` and `Hughes_assignment_6.zip`; Fall 2025 `Responsive Web Design/Module6.zip` | HTML/CSS, responsive layouts, DOM events, and interactive forms |
| Advanced JavaScript | A1 callback data accessor submission; callback/promise/async-await and class notes; week 4 MongoDB material | Node.js modules, asynchronous programming, JSON data access; MongoDB retained as introductory familiarity |
| Enterprise Java | `0-Fall2026/EnterpriseJava/exercises/inClassExercises/inClassEx08/java-ex08-rory-hughes` repositories, entities, and web application source | Servlets, JSP, JPA, and database-backed menu/order workflows |
| Server-side web | `0-Fall2026/Server-SideWeb-MVCFramework/exercises/Ex06SessionSurvey` page models and startup | ASP.NET Core/Razor Pages, request handling, form validation, and session state |
| Software engineering | Winter 2026 requirements, UML/use-case/activity/class diagram, and planning materials | Requirements analysis, UML/use-case modelling, project planning, Agile concepts |
| Bash | `0-Winter2026/Bash/safeCopy.sh` and file-management/permissions/archive exercises | Shell scripting, argument validation, file management, permissions |

The existing AWS foundations and badge record is retained. The broad program
catalogue contains future subjects as well as current subjects, so it was not
used to add C++, embedded systems, PHP, Spring Boot, or other unverified study.
TypeScript is attributed to this Astro portfolio rather than coursework.
GitHub Actions is supported by the repository's manual build/release workflow;
the wording does not claim an automatic deployment or a new deployed release.

## Poster review

The owner's requested actual application stills are published as separate,
lossless WebP posters. Source recordings remain unchanged. Raw frame samples and
scratch selections remain in the operating system's temp directory. Each poster
was visually checked against the already approved recording. No new application
captures or school material were published.

| Recording | Selected time | Visible preview |
| --- | --- | --- |
| John Howard application walkthrough | 40.100 s | Generated draft form and publication review; synthetic example program |
| Mileage dashboard and trip review | 0.961 s | Dashboard with allowance estimate and recent trips |
| Mileage trip records | 15.056 s | Trip details, attachment control, and recorded-route preview |
| Mileage manual tracking | 5.361 s | Stable ready-to-start tracking screen, after its transition |
| Mileage settings and vehicles | 24.756 s | Vehicle form and odometer field |
| Mileage reports and logbook | 12.950 s | Quarterly report, export controls, and review warning |

The poster framing preserves the full 1280 × 720 recording frame. Existing
portrait-player styling presents MileageTracker's centred Android screen.
Posters inherit their recording's explicit public/approved review state and are
checked by both content validation and built-output validation.

## Validation

- `npm run ci:validate`: zero Astro diagnostics, 22 passing tests, 11 static
  pages, and passing output/link/media/resume/release-manifest checks.
- Rebuilt after the final primary-language styling change; output checks passed.
- Browser inspection at 1440 px and 390 px: posters visible, no horizontal
  overflow on Home, Skills, Education, or either application case study. Every
  case-study recording has a poster and makes no initial video-data request.
- Both homepage demo buttons played their recordings; the cue hides during play
  and returns at the end. Native controls/posters work with JavaScript disabled.
  With JavaScript, native controls appear when playback starts, keeping the
  initial still clear of browser loading overlays. Keyboard activation was checked.
- Existing regression checks verified all six original video digests unchanged.
- Validation used the bundled Node.js 24.19.0 runtime. The README's exact
  24.21.0 runtime was unavailable locally; that exact-version run is unverified.
- Changes are local. No commit, push, Pages release, or application acceptance
  run was performed. Existing header and resume-download edits were preserved.
