import SwiftUI

/// Ask Slate (the web's AI conversation): a question in plain words, an answer
/// as it is written, and the titles it found, each ready to add.
struct AskSlateView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let firstQuestion: String

    private struct Turn: Identifiable {
        let id = UUID()
        let role: AIChatMessage.Role
        var text: String
        var results: [AIChatResult] = []
        var searching = false
        var failed = false
    }

    @State private var turns: [Turn] = []
    @State private var draft = ""
    @State private var answering = false
    @State private var asked = false
    @FocusState private var fieldFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(SlatePalette.mutedText)
                    TextField("", text: $draft, prompt: Text("Ask anything…").foregroundStyle(SlatePalette.mutedText))
                        .font(.system(size: 18))
                        .foregroundStyle(SlatePalette.text)
                        .submitLabel(.send)
                        .focused($fieldFocused)
                        .onSubmit { send(draft) }
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(SlatePalette.mutedText)
                            .frame(width: 40, height: 40)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close")
                }
                .padding(.horizontal, 16)
                .frame(height: 60)
                Divider().overlay(SlatePalette.border)

                HStack {
                    Button { dismiss() } label: {
                        Label("Back to results", systemImage: "arrow.left")
                            .font(.system(size: 15))
                            .foregroundStyle(SlatePalette.mutedText)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    if !turns.isEmpty {
                        Button {
                            turns = []
                            draft = ""
                            fieldFocused = true
                        } label: {
                            Label("Clear", systemImage: "trash")
                                .font(.system(size: 15))
                                .foregroundStyle(SlatePalette.mutedText)
                        }
                        .buttonStyle(.plain)
                        .disabled(answering)
                    }
                }
                .padding(.horizontal, 18)
                .frame(height: 52)
                Divider().overlay(SlatePalette.border)

                ScrollViewReader { reader in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 18) {
                            ForEach(turns) { turn in
                                if turn.role == .user {
                                    Text(turn.text)
                                        .font(.system(size: 16))
                                        .foregroundStyle(SlatePalette.text)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 11)
                                        .background(SlatePalette.accent.opacity(0.12), in: .rect(cornerRadius: 20))
                                        .frame(maxWidth: .infinity, alignment: .trailing)
                                        .padding(.leading, 48)
                                } else {
                                    answer(turn)
                                }
                            }
                            Color.clear.frame(height: 1).id("end")
                        }
                        .padding(18)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: turns.last?.text) { _, _ in
                        withAnimation(.smooth(duration: 0.2)) { reader.scrollTo("end", anchor: .bottom) }
                    }
                }
            }
            .background(SlatePalette.surface.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: AIChatResult.self) { result in
                CatalogDestinationByID(mediaType: result.mediaType, tmdbId: result.tmdbId)
            }
        }
        .task {
            guard !asked else { return }
            asked = true
            if firstQuestion.isEmpty { fieldFocused = true } else { send(firstQuestion) }
        }
    }

    private func answer(_ turn: Turn) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "sparkles")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(SlatePalette.accent)
                .frame(width: 36, height: 36)
                .background(SlatePalette.accent.opacity(0.14), in: .circle)
            VStack(alignment: .leading, spacing: 12) {
                if turn.text.isEmpty && turn.results.isEmpty && !turn.failed {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small).tint(SlatePalette.mutedText)
                        Text(turn.searching ? "Searching…" : "Thinking…")
                            .font(.system(size: 16))
                            .foregroundStyle(SlatePalette.mutedText)
                    }
                    .frame(minHeight: 36)
                } else {
                    if !turn.text.isEmpty {
                        Text(LocalizedStringKey(turn.text))
                            .font(.system(size: 16))
                            .lineSpacing(4)
                            .foregroundStyle(turn.failed ? SlatePalette.danger : SlatePalette.text)
                            .textSelection(.enabled)
                            .padding(.top, 7)
                    }
                    if !turn.results.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(alignment: .top, spacing: 10) {
                                ForEach(turn.results) { result in
                                    NavigationLink(value: result) {
                                        LabeledPoster(
                                            url: result.posterURL,
                                            title: result.title,
                                            leading: result.mediaType == .movie ? "Film" : "Series",
                                            trailing: result.year,
                                            saved: result.libraryId != nil
                                                || model.titles.contains { $0.tmdbId == result.tmdbId && $0.mediaType == result.mediaType }
                                        )
                                        .frame(width: 112)
                                    }
                                    .buttonStyle(SlatePressStyle())
                                }
                            }
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func send(_ text: String) {
        let question = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !answering else { return }
        draft = ""
        let history = turns.filter { !$0.failed }.suffix(10).map { AIChatMessage(role: $0.role, content: $0.text) }
        turns.append(Turn(role: .user, text: question))
        turns.append(Turn(role: .assistant, text: ""))
        let index = turns.count - 1
        answering = true
        Task {
            do {
                for try await event in model.askSlate(history + [AIChatMessage(role: .user, content: question)]) {
                    switch event {
                    case .text(let delta): turns[index].text += delta
                    case .searchStart: turns[index].searching = true
                    case .results(let results): turns[index].results += results
                    case .error(let message):
                        turns[index].text = message
                        turns[index].failed = true
                    case .done: break
                    }
                }
            } catch {
                turns[index].text = error.localizedDescription
                turns[index].failed = true
            }
            answering = false
        }
    }
}
