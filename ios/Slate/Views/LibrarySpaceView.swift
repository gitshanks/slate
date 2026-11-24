import SwiftUI

/// Space (`components/spatial-poster-grid.tsx`): every poster of the shelf on
/// one canvas that repeats in every direction. Drag to wander, pinch to step
/// back; posters swell as they near the middle, like a lens over the wall.
struct LibrarySpaceView: View {
    let titles: [SlateTitle]
    let onOpen: (SlateTitle) -> Void

    // The web's geometry: a 142 × 213 poster every 206 pt across, 286 pt down.
    private let posterSize = CGSize(width: 142, height: 213)
    private let columnGap: CGFloat = 206
    private let rowGap: CGFloat = 286
    private let lensMin: CGFloat = 0.5
    private let lensRange: CGFloat = 0.76

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var offset: CGSize = .zero
    @State private var dragStart: CGSize?
    @State private var scale: CGFloat = 0.7
    @State private var pinchStart: CGFloat?

    private var columns: Int { min(8, max(4, Int(ceil(sqrt(Double(titles.count) * 1.35))))) }
    private var rows: Int { max(1, Int(ceil(Double(titles.count) / Double(columns)))) }

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            ZStack(alignment: .topLeading) {
                ForEach(cells(in: size), id: \.key) { cell in
                    let title = titles[cell.index]
                    let distance = hypot(cell.point.x - center.x, cell.point.y - center.y)
                    let reach = max(size.width, size.height) * 0.62
                    let focus = max(0, 1 - distance / reach)
                    let lens = (lensMin + lensRange * focus) * scale
                    Button { onOpen(title) } label: {
                        SpacePoster(title: title, size: posterSize, focus: focus)
                    }
                    .buttonStyle(SlatePressStyle())
                    .scaleEffect(lens)
                    .position(cell.point)
                    .zIndex(Double(focus))
                }
            }
            .frame(width: size.width, height: size.height)
            .clipped()
            .background {
                RadialGradient(
                    colors: [SlatePalette.accent.opacity(0.07), .clear],
                    center: .center,
                    startRadius: 0,
                    endRadius: max(size.width, size.height) * 0.6
                )
            }
            .contentShape(.rect)
            .gesture(pan.simultaneously(with: pinch))
        }
        .overlay {
            if titles.isEmpty {
                SlateEmptyMessage(title: "No titles match", message: "Try another filter or search.")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Space view")
    }

    private struct Cell {
        let key: String
        let index: Int
        let point: CGPoint
    }

    /// The posters near the window, wrapping the shelf around in both directions.
    private func cells(in size: CGSize) -> [Cell] {
        guard !titles.isEmpty else { return [] }
        let stepX = columnGap * scale
        let stepY = rowGap * scale
        let originX = size.width / 2 + offset.width
        let originY = size.height / 2 + offset.height
        let firstColumn = Int(floor((0 - originX) / stepX)) - 2
        let lastColumn = Int(ceil((size.width - originX) / stepX)) + 2
        let firstRow = Int(floor((0 - originY) / stepY)) - 2
        let lastRow = Int(ceil((size.height - originY) / stepY)) + 2
        var result: [Cell] = []
        for row in firstRow...lastRow {
            for column in firstColumn...lastColumn {
                let wrappedRow = ((row % rows) + rows) % rows
                let wrappedColumn = ((column % columns) + columns) % columns
                let index = wrappedRow * columns + wrappedColumn
                guard index < titles.count else { continue }
                // Odd rows sit half a step over, so the wall reads as a weave.
                let shift = row.isMultiple(of: 2) ? 0 : stepX / 2
                result.append(Cell(
                    key: "\(row):\(column)",
                    index: index,
                    point: CGPoint(x: originX + CGFloat(column) * stepX + shift, y: originY + CGFloat(row) * stepY)
                ))
            }
        }
        return result
    }

    private var pan: some Gesture {
        DragGesture(minimumDistance: 4)
            .onChanged { value in
                let start = dragStart ?? offset
                if dragStart == nil { dragStart = offset }
                offset = CGSize(width: start.width + value.translation.width, height: start.height + value.translation.height)
            }
            .onEnded { value in
                dragStart = nil
                guard !reduceMotion else { return }
                // Let go and the wall keeps a little of the throw.
                let throwX = (value.predictedEndTranslation.width - value.translation.width) * 0.5
                let throwY = (value.predictedEndTranslation.height - value.translation.height) * 0.5
                withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.7)) {
                    offset.width += throwX
                    offset.height += throwY
                }
            }
    }

    private var pinch: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let start = pinchStart ?? scale
                if pinchStart == nil { pinchStart = scale }
                scale = min(1.3, max(0.45, start * value.magnification))
            }
            .onEnded { _ in pinchStart = nil }
    }
}

/// A poster on the wall, with its name and shelf under it once it is near
/// enough the middle to read.
private struct SpacePoster: View {
    let title: SlateTitle
    let size: CGSize
    let focus: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            PosterTile(title: title, corner: 16)
                .frame(width: size.width, height: size.height)
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(SlatePalette.text.opacity(0.1), lineWidth: 1) }
                .shadow(color: .black.opacity(0.45), radius: 22, y: 14)
            Text(title.title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(SlatePalette.text.opacity(0.9))
                .lineLimit(1)
                .padding(.top, 6)
            HStack {
                SlateMonoLabel(title.status.label, size: 9)
                Spacer(minLength: 0)
                if let year = title.year { SlateMonoLabel(year, size: 9) }
            }
        }
        .frame(width: size.width)
        .opacity(0.35 + 0.65 * Double(min(1, focus * 1.6)))
    }
}
