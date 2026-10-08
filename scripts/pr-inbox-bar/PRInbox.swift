// PR Inbox: a menu bar front end for scripts/pr-inbox.mjs.
// Lists the automated reviews waiting for approval and lets you read, edit, publish or discard them.
// Every action goes through pr-inbox.mjs, so the rules (stale-commit check, marker check) live in one place.
// Build and install with ./build.sh (see README.md next to this file).

import AppKit

struct Item: Decodable {
    let id: String
    let repo: String
    let number: Int
    let url: String
    let title: String
    let author: String?
    let status: String
    let verdict: String?
    let summary: String?
    let commentUrl: String?
    let createdAt: String
    let dir: String
    let screenshots: [String]?   // browser test (frontend), failures first
    let report: String?          // browser test report.md

    var label: String { "\(repo)#\(number)" }
    var commentPath: String { dir + "/comment.md" }
    var logPath: String {
        let review = dir + "/review.log"
        return FileManager.default.fileExists(atPath: review) ? review : dir + "/browser-test.log"
    }
}

struct RunResult {
    let status: Int32
    let output: String
}

/// Runs `node scripts/pr-inbox.mjs …` with a PATH that finds node, gh and claude
/// (apps started from Finder or launchd don't get your shell's PATH).
enum Script {
    static let root: String = Bundle.main.object(forInfoDictionaryKey: "PRInboxRoot") as? String ?? ""

    static func process(_ args: [String]) -> Process {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        p.arguments = ["node", root + "/scripts/pr-inbox.mjs"] + args
        p.currentDirectoryURL = URL(fileURLWithPath: root)
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = "\(home)/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        p.environment = env
        return p
    }

    static func run(_ args: [String]) -> RunResult {
        let p = process(args)
        let pipe = Pipe()
        p.standardOutput = pipe
        p.standardError = pipe
        do { try p.run() } catch { return RunResult(status: -1, output: error.localizedDescription) }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return RunResult(status: p.terminationStatus, output: String(decoding: data, as: UTF8.self))
    }

    /// Long runs (a review takes minutes): start detached, the inbox shows its progress.
    static func start(_ args: [String], onError: (@Sendable @MainActor (String) -> Void)? = nil) {
        let p = process(args)
        p.standardOutput = FileHandle.nullDevice
        let pipe = Pipe()
        p.standardError = pipe
        do {
            try p.run()
            DispatchQueue.global(qos: .utility).async {
                p.waitUntilExit()
                if p.terminationStatus != 0 {
                    let data = pipe.fileHandleForReading.readDataToEndOfFile()
                    let msg = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !msg.isEmpty {
                        Task { @MainActor in
                            onError?(msg)
                        }
                    }
                }
            }
        } catch {
            Task { @MainActor in
                onError?(error.localizedDescription)
            }
        }
    }

    static func items() -> [Item] {
        let r = run(["list", "--json"])
        guard r.status == 0, let data = r.output.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([Item].self, from: data)) ?? []
    }
}

func symbol(_ name: String, _ description: String) -> NSImage? {
    NSImage(systemSymbolName: name, accessibilityDescription: description)
}

func verdictSymbol(_ verdict: String?) -> NSImage? {
    switch verdict {
    case "Aprobado": return symbol("checkmark.circle", "Aprobado")
    case "Rechazado": return symbol("xmark.octagon", "Rechazado")
    default: return symbol("exclamationmark.triangle", "Requiere cambios")
    }
}

@discardableResult
func alert(_ title: String, _ text: String, buttons: [String] = ["OK"], style: NSAlert.Style = .informational) -> Int {
    NSApp.activate(ignoringOtherApps: true)
    let a = NSAlert()
    a.messageText = title
    a.informativeText = text
    a.alertStyle = style
    buttons.forEach { a.addButton(withTitle: $0) }
    return a.runModal().rawValue - NSApplication.ModalResponse.alertFirstButtonReturn.rawValue
}

// MARK: - Draft window

/// One window per draft: the comment as it will be posted, plus the actions.
/// The text reloads whenever the window comes back to the front, so edits made in your editor show up.
final class DraftWindow: NSObject, NSWindowDelegate {
    let item: Item
    let window: NSWindow
    let textView: NSTextView
    let onChange: () -> Void
    var onClose: (() -> Void)?

    init(item: Item, onChange: @escaping () -> Void) {
        self.item = item
        self.onChange = onChange
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 760, height: 600),
                          styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "\(item.label) · \(item.verdict ?? "?") — \(item.title)"
        window.isReleasedWhenClosed = false
        window.center()

        let scroll = NSTextView.scrollableTextView()
        textView = scroll.documentView as! NSTextView
        textView.isEditable = false
        textView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        textView.textContainerInset = NSSize(width: 12, height: 12)

        super.init()
        window.delegate = self

        let open = NSButton(title: "Open PR", target: self, action: #selector(openPR))
        let edit = NSButton(title: "Edit…", target: self, action: #selector(editDraft))
        let report = NSButton(title: "Test report", target: self, action: #selector(openReport))
        report.isHidden = item.report == nil
        let discard = NSButton(title: "Discard", target: self, action: #selector(discard))
        let publish = NSButton(title: "Publish", target: self, action: #selector(publish))
        publish.keyEquivalent = "\r"
        let spacer = NSView()
        spacer.setContentHuggingPriority(.init(1), for: .horizontal)
        let bar = NSStackView(views: [open, edit, report, spacer, discard, publish])
        bar.edgeInsets = NSEdgeInsets(top: 10, left: 12, bottom: 12, right: 12)

        var views: [NSView] = [scroll]
        if let shots = item.screenshots, !shots.isEmpty {
            views.append(Self.screenshotStrip(shots, target: self))
            window.setContentSize(NSSize(width: 900, height: 780))
            window.center()
        }
        views.append(bar)
        let stack = NSStackView(views: views)
        stack.orientation = .vertical
        stack.spacing = 0
        window.contentView = stack
        views.forEach { $0.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true }
        reload()
    }

    func show() {
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    func reload() {
        textView.string = (try? String(contentsOfFile: item.commentPath, encoding: .utf8)) ?? "(draft not found)"
    }

    func windowDidBecomeKey(_ notification: Notification) { reload() }
    func windowWillClose(_ notification: Notification) { onClose?() }

    @objc func openPR() { NSWorkspace.shared.open(URL(string: item.url)!) }

    @objc func openReport() {
        guard let report = item.report else { return }
        NSWorkspace.shared.open(URL(fileURLWithPath: report))
    }

    /// Opens the clicked screenshot in Preview, with the rest of the run's screenshots in its sidebar.
    @objc func openScreenshot(_ sender: NSButton) {
        guard let shots = item.screenshots else { return }
        let clicked = shots[sender.tag]
        let urls = ([clicked] + shots.filter { $0 != clicked }).map { URL(fileURLWithPath: $0) }
        let preview = URL(fileURLWithPath: "/System/Applications/Preview.app")
        NSWorkspace.shared.open(urls, withApplicationAt: preview, configuration: NSWorkspace.OpenConfiguration())
    }

    /// Browser-test screenshots under the comment: a horizontal strip of thumbnails, failures first (in red).
    static func screenshotStrip(_ shots: [String], target: DraftWindow) -> NSView {
        let fails = shots.filter { $0.contains("-fail") }.count
        let title = NSTextField(labelWithString: "Browser test · \(shots.count) screenshots" + (fails > 0 ? " · \(fails) failed" : ""))
        title.font = .boldSystemFont(ofSize: 12)
        if fails > 0 { title.textColor = .systemRed }

        let row = NSStackView()
        row.orientation = .horizontal
        row.spacing = 10
        row.alignment = .top
        for (index, path) in shots.enumerated() {
            let name = (path as NSString).lastPathComponent.replacingOccurrences(of: ".png", with: "")
            let button = NSButton(title: name, image: NSImage(contentsOfFile: path) ?? NSImage(),
                                  target: target, action: #selector(openScreenshot(_:)))
            button.tag = index
            button.isBordered = false
            button.imagePosition = .imageAbove
            button.imageScaling = .scaleProportionallyUpOrDown
            button.font = .systemFont(ofSize: 11)
            if name.contains("-fail") { button.contentTintColor = .systemRed }
            button.toolTip = "Open \(name) in Preview"
            button.widthAnchor.constraint(equalToConstant: 200).isActive = true
            button.heightAnchor.constraint(equalToConstant: 150).isActive = true
            row.addArrangedSubview(button)
        }

        let scroll = NSScrollView()
        scroll.hasHorizontalScroller = true
        scroll.drawsBackground = false
        scroll.documentView = row
        row.translatesAutoresizingMaskIntoConstraints = false
        row.edgeInsets = NSEdgeInsets(top: 0, left: 0, bottom: 0, right: 12)
        let clip = scroll.contentView
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: clip.leadingAnchor),
            row.topAnchor.constraint(equalTo: clip.topAnchor),
            row.heightAnchor.constraint(equalTo: clip.heightAnchor),
            scroll.heightAnchor.constraint(equalToConstant: 170),
        ])

        let section = NSStackView(views: [title, scroll])
        section.orientation = .vertical
        section.alignment = .leading
        section.spacing = 6
        section.edgeInsets = NSEdgeInsets(top: 10, left: 12, bottom: 0, right: 0)
        scroll.widthAnchor.constraint(equalTo: section.widthAnchor, constant: -12).isActive = true
        return section
    }

    @objc func editDraft() {
        // Your default text editor; the window reloads the text when you come back to it.
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        p.arguments = ["-t", item.commentPath]
        try? p.run()
    }

    @objc func discard() {
        guard alert("Discard the review of \(item.label)?", "The draft stays on disk but leaves the inbox. Nothing is posted.",
                    buttons: ["Discard", "Cancel"], style: .warning) == 0 else { return }
        finish(Script.run(["discard", item.id]))
    }

    @objc func publish() {
        guard alert("Publish this comment on \(item.label)?",
                    "It's posted from your GitHub account as it appears in this window.",
                    buttons: ["Publish", "Cancel"]) == 0 else { return }
        let r = Script.run(["post", item.id])
        if r.status != 0 && r.output.contains("new commits") {
            // The PR moved on since the review: post the old one anyway, or review the new code.
            switch alert("\(item.label) has new commits", r.output.replacingOccurrences(of: "pr-inbox: ", with: ""),
                         buttons: ["Review again", "Publish anyway", "Cancel"], style: .warning) {
            case 0:
                Script.start(["review", item.id]) { err in
                    alert("No se pudo iniciar la revisión", err.replacingOccurrences(of: "pr-inbox: ", with: ""), style: .warning)
                }
                window.close()
                onChange()
            case 1: finish(Script.run(["post", item.id, "--force"]))
            default: break
            }
            return
        }
        finish(r)
    }

    private func finish(_ r: RunResult) {
        if r.status != 0 {
            alert("That didn't work", r.output, style: .critical)
            return
        }
        window.close()
        onChange()
    }
}

// MARK: - Menu bar

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let menu = NSMenu()
    var items: [Item] = []
    var windows: [String: DraftWindow] = [:]
    var timer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        menu.delegate = self
        statusItem.menu = menu
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            MainActor.assumeIsolated { self.refresh() }
        }
    }

    func refresh() {
        items = Script.items()
        let pending = items.filter { $0.status == "pending" }.count
        let running = items.contains { $0.status == "running" }
        let button = statusItem.button!
        button.image = symbol(pending > 0 ? "tray.full.fill" : (running ? "tray.and.arrow.down" : "tray"), "PR Inbox")
        button.title = pending > 0 ? " \(pending)" : ""
        button.imagePosition = .imageLeading
        button.toolTip = pending > 0 ? "\(pending) review(s) waiting for approval" : "PR Inbox: nothing to review"
    }

    func isReviewRunning(repo: String, number: Int) -> Bool {
        return items.contains { $0.repo == repo && $0.number == number && $0.status == "running" }
    }

    func isReviewRunning(ref: String) -> Bool {
        let parts = ref.split(separator: "#")
        guard parts.count == 2, let num = Int(parts[1]) else { return false }
        return isReviewRunning(repo: String(parts[0]), number: num)
    }

    func anyRunningReview() -> Item? {
        return items.first { $0.status == "running" }
    }

    func indicateReviewStarted() {
        let button = statusItem.button!
        button.image = symbol("tray.and.arrow.down", "Reviewing now")
        button.toolTip = "PR Inbox: iniciando revisión…"
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.refresh() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { self.refresh() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { self.refresh() }
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        refresh()
        menu.removeAllItems()

        let pending = items.filter { $0.status == "pending" }
        let running = items.filter { $0.status == "running" }
        // "skipped" = the review ended without a draft; its summary says why (it may have stopped on an error).
        let problems = items.filter { ["failed", "interrupted", "skipped"].contains($0.status) }
        let posted = items.filter { $0.status == "posted" }.suffix(5).reversed()

        section("To review", count: pending.count)
        if pending.isEmpty { note("Nothing waiting for you") }
        for i in pending {
            let mi = add("\(i.label) · \(i.verdict ?? "?") — \(short(i.title))", #selector(openDraft(_:)), i.id)
            mi.image = verdictSymbol(i.verdict)
            let shots = i.screenshots?.count ?? 0
            mi.toolTip = [i.summary, shots > 0 ? "\(shots) browser-test screenshots" : nil].compactMap { $0 }.joined(separator: "\n")
        }

        if !running.isEmpty {
            section("Reviewing now", count: running.count)
            for i in running {
                add("\(i.label) — \(short(i.title))", #selector(openLog(_:)), i.id).image = symbol("hourglass", "running")
            }
        }

        if !problems.isEmpty {
            section("Didn't finish", count: problems.count)
            for i in problems {
                let mi = add("\(i.label) — \(i.status)", nil, nil)
                mi.image = symbol("exclamationmark.circle", i.status)
                mi.toolTip = i.summary
                let sub = NSMenu()
                let running = isReviewRunning(repo: i.repo, number: i.number)
                let reviewItem = item(running ? "Reviewing now…" : "Review again", running ? nil : #selector(reviewAgain(_:)), i.id)
                if running {
                    reviewItem.isEnabled = false
                }
                sub.addItem(reviewItem)
                sub.addItem(item("View log", #selector(openLog(_:)), i.id))
                sub.addItem(item("Dismiss", #selector(dismiss(_:)), i.id))
                mi.submenu = sub
            }
        }

        if !posted.isEmpty {
            section("Recently published", count: nil)
            for i in posted {
                add("\(i.label) · \(i.verdict ?? "") — \(short(i.title))", #selector(openComment(_:)), i.id)
                    .image = symbol("paperplane", "published")
            }
        }

        menu.addItem(.separator())
        add("Review a PR…", #selector(reviewPR), nil)
        add("Open inbox folder", #selector(openFolder), nil)
        menu.addItem(.separator())
        add("Quit PR Inbox", #selector(NSApplication.terminate(_:)), nil).target = NSApp
    }

    // MARK: menu helpers

    private func section(_ title: String, count: Int?) {
        if menu.numberOfItems > 0 { menu.addItem(.separator()) }
        menu.addItem(NSMenuItem.sectionHeader(title: count.map { "\(title) (\($0))" } ?? title))
    }

    private func note(_ text: String) {
        let mi = NSMenuItem(title: text, action: nil, keyEquivalent: "")
        mi.isEnabled = false
        menu.addItem(mi)
    }

    private func item(_ title: String, _ action: Selector?, _ id: String?) -> NSMenuItem {
        let mi = NSMenuItem(title: title, action: action, keyEquivalent: "")
        mi.target = self
        mi.representedObject = id
        return mi
    }

    @discardableResult
    private func add(_ title: String, _ action: Selector?, _ id: String?) -> NSMenuItem {
        let mi = item(title, action, id)
        menu.addItem(mi)
        return mi
    }

    private func short(_ s: String) -> String { s.count > 55 ? String(s.prefix(54)) + "…" : s }

    private func find(_ sender: NSMenuItem) -> Item? {
        items.first { $0.id == sender.representedObject as? String }
    }

    // MARK: actions

    @objc func openDraft(_ sender: NSMenuItem) {
        guard let i = find(sender) else { return }
        if let w = windows[i.id] { return w.show() }
        let w = DraftWindow(item: i) { [weak self] in self?.refresh() }
        w.onClose = { [weak self] in self?.windows[i.id] = nil }
        windows[i.id] = w
        w.show()
    }

    @objc func openLog(_ sender: NSMenuItem) {
        guard let i = find(sender) else { return }
        NSWorkspace.shared.open(URL(fileURLWithPath: FileManager.default.fileExists(atPath: i.logPath) ? i.logPath : i.dir))
    }

    @objc func openComment(_ sender: NSMenuItem) {
        guard let i = find(sender) else { return }
        NSWorkspace.shared.open(URL(string: i.commentUrl ?? i.url)!)
    }

    @objc func reviewAgain(_ sender: NSMenuItem) {
        guard let i = find(sender) else { return }
        if isReviewRunning(repo: i.repo, number: i.number) {
            alert("PR en proceso", "La \(i.label) ya se está revisando en este momento.", style: .warning)
            return
        }
        if let other = anyRunningReview() {
            let choice = alert("Revisión en curso", "Ya se está revisando \(other.label). Ejecutar revisiones concurrentes puede saturar la cuota de tokens.\n\n¿Querés iniciar \(i.label) de todos modos?", buttons: ["Iniciar de todos modos", "Cancelar"], style: .warning)
            guard choice == 0 else { return }
        }
        Script.start(["review", i.id]) { [weak self] err in
            alert("No se pudo iniciar la revisión", err.replacingOccurrences(of: "pr-inbox: ", with: ""), style: .warning)
            self?.refresh()
        }
        indicateReviewStarted()
    }

    @objc func dismiss(_ sender: NSMenuItem) {
        guard let i = find(sender) else { return }
        _ = Script.run(["discard", i.id])
        refresh()
    }

    @objc func reviewPR() {
        NSApp.activate(ignoringOtherApps: true)
        let a = NSAlert()
        a.messageText = "Review a PR now"
        a.informativeText = "backend#72 or frontend#135. Frontend PRs get the browser test first. It takes a few minutes; the PR shows up under \"Reviewing now\"."
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 240, height: 24))
        field.placeholderString = "backend#72"
        a.accessoryView = field
        a.addButton(withTitle: "Review")
        a.addButton(withTitle: "Cancel")
        a.window.initialFirstResponder = field
        guard a.runModal() == .alertFirstButtonReturn else { return }
        let ref = field.stringValue.trimmingCharacters(in: .whitespaces)
        guard ref.range(of: #"^(backend|frontend)#\d+$"#, options: .regularExpression) != nil else {
            alert("Not a PR reference", "Use backend#<number> or frontend#<number>.", style: .warning)
            return
        }
        if isReviewRunning(ref: ref) {
            alert("PR en proceso", "La \(ref) ya se está revisando en este momento. Podés ver el estado en \"Reviewing now\".", style: .warning)
            return
        }
        if let other = anyRunningReview() {
            let choice = alert("Revisión en curso", "Ya se está revisando \(other.label). Ejecutar revisiones concurrentes puede saturar la cuota de tokens.\n\n¿Querés iniciar \(ref) de todos modos?", buttons: ["Iniciar de todos modos", "Cancelar"], style: .warning)
            guard choice == 0 else { return }
        }
        Script.start(["review", ref]) { [weak self] err in
            alert("No se pudo iniciar la revisión", err.replacingOccurrences(of: "pr-inbox: ", with: ""), style: .warning)
            self?.refresh()
        }
        indicateReviewStarted()
    }

    @objc func openFolder() {
        NSWorkspace.shared.open(URL(fileURLWithPath: Script.root + "/review-artifacts/inbox"))
    }
}

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    app.run()
}
