import Observation
import QuartzCore
import SwiftUI

/// The two springs of a liquid selector, as stiffness and damping at mass 1
/// (the same numbers as the web's `components/liquid-selector.tsx` and
/// Android's `LiquidSelector.kt`): the leading edge runs ahead and the
/// trailing edge follows, so the body stretches as it travels and settles
/// back into a pill.
struct LiquidSprings: Equatable {
    let leadStiffness: Double
    let leadDamping: Double
    let tailStiffness: Double
    let tailDamping: Double

    /// Small controls: segmented filters and switches.
    static let control = LiquidSprings(leadStiffness: 380, leadDamping: 29, tailStiffness: 235, tailDamping: 26)
    /// The dock only: the same motion, played slower.
    static let dock = LiquidSprings(leadStiffness: 250, leadDamping: 23, tailStiffness: 150, tailDamping: 21)
    /// A slider you throw: the front lands with a visible overshoot.
    static let slider = LiquidSprings(leadStiffness: 320, leadDamping: 20, tailStiffness: 210, tailDamping: 21)
}

/// Where the body's two edges are, in option positions (0 is the first
/// option, 1 the second). Each edge is its own spring, stepped on the display's
/// frames so a drag can hold one edge while the other keeps following.
@MainActor
@Observable
final class LiquidMotion {
    private(set) var lead: Double
    private(set) var tail: Double

    @ObservationIgnored private var leadTarget: Double
    @ObservationIgnored private var tailTarget: Double
    @ObservationIgnored private var leadVelocity = 0.0
    @ObservationIgnored private var tailVelocity = 0.0
    @ObservationIgnored private var springs = LiquidSprings.control
    @ObservationIgnored private var link: CADisplayLink?
    @ObservationIgnored private var proxy: LinkProxy?

    init(at position: Int) {
        let value = Double(position)
        lead = value
        tail = value
        leadTarget = value
        tailTarget = value
    }

    var target: Double { leadTarget }

    /// Both edges head for an option.
    func settle(at position: Double, springs: LiquidSprings, animated: Bool) {
        self.springs = springs
        leadTarget = position
        tailTarget = position
        if animated { start() } else { jump(to: position) }
    }

    /// A finger holds the leading edge; the trailing edge follows it.
    func hold(at position: Double, springs: LiquidSprings, animated: Bool) {
        self.springs = springs
        guard animated else { jump(to: position); return }
        lead = position
        leadTarget = position
        leadVelocity = 0
        tailTarget = position
        start()
    }

    private func jump(to position: Double) {
        stop()
        leadTarget = position
        tailTarget = position
        leadVelocity = 0
        tailVelocity = 0
        lead = position
        tail = position
    }

    private func start() {
        guard link == nil else { return }
        let proxy = LinkProxy(owner: self)
        let link = CADisplayLink(target: proxy, selector: #selector(LinkProxy.tick(_:)))
        link.add(to: .main, forMode: .common)
        self.proxy = proxy
        self.link = link
    }

    private func stop() {
        link?.invalidate()
        link = nil
        proxy = nil
    }

    fileprivate func advance(by elapsed: Double) {
        // Small fixed steps keep the stiff lead spring stable on a slow frame.
        var frame = min(max(elapsed, 0), 1.0 / 30.0)
        #if DEBUG
        frame /= SlatePreview.liquidSlowdown
        #endif
        let steps = 4
        let dt = frame / Double(steps)
        var a = lead, b = tail
        for _ in 0..<steps {
            leadVelocity += (-springs.leadStiffness * (a - leadTarget) - springs.leadDamping * leadVelocity) * dt
            a += leadVelocity * dt
            tailVelocity += (-springs.tailStiffness * (b - tailTarget) - springs.tailDamping * tailVelocity) * dt
            b += tailVelocity * dt
        }
        let resting = abs(a - leadTarget) < 0.0005 && abs(leadVelocity) < 0.005
            && abs(b - tailTarget) < 0.0005 && abs(tailVelocity) < 0.005
        if resting {
            a = leadTarget
            b = tailTarget
            leadVelocity = 0
            tailVelocity = 0
            stop()
        }
        lead = a
        tail = b
    }
}

@MainActor
private final class LinkProxy: NSObject {
    weak var owner: LiquidMotion?
    init(owner: LiquidMotion) { self.owner = owner }

    @objc func tick(_ link: CADisplayLink) {
        guard let owner else { link.invalidate(); return }
        owner.advance(by: link.targetTimestamp - link.timestamp)
    }
}

private struct LiquidLabelWidths: PreferenceKey {
    static let defaultValue: [Int: CGFloat] = [:]
    static func reduce(value: inout [Int: CGFloat], nextValue: () -> [Int: CGFloat]) {
        value.merge(nextValue()) { $1 }
    }
}

/// Where each option sits: every label gets its own width plus an equal share
/// of what is left, so short and long labels breathe alike.
private struct LiquidSlots {
    var lefts: [CGFloat] = []
    var widths: [CGFloat] = []

    init(count: Int, total: CGFloat, natural: [Int: CGFloat]) {
        guard count > 0, total > 0 else { return }
        let wanted = (0..<count).map { natural[$0] ?? 0 }
        let spare = total - wanted.reduce(0, +)
        let measured = natural.count >= count
        widths = measured && spare >= 0
            ? wanted.map { $0 + spare / CGFloat(count) }
            : Array(repeating: total / CGFloat(count), count: count)
        var x: CGFloat = 0
        for width in widths { lefts.append(x); x += width }
    }

    func left(at position: Double) -> CGFloat {
        let last = lefts.count - 1
        guard last >= 0 else { return 0 }
        if position <= 0 { return lefts[0] + CGFloat(position) * widths[0] }
        if position >= Double(last) { return lefts[last] + CGFloat(position - Double(last)) * widths[last] }
        let index = Int(position)
        return lefts[index] + (lefts[index + 1] - lefts[index]) * CGFloat(position - Double(index))
    }

    func width(at position: Double) -> CGFloat {
        let last = widths.count - 1
        guard last >= 0 else { return 0 }
        let clamped = min(max(position, 0), Double(last))
        let index = min(Int(clamped), last)
        let next = min(index + 1, last)
        return widths[index] + (widths[next] - widths[index]) * CGFloat(clamped - Double(index))
    }

    /// The body between its two edges. Stretched, it thins a little, never
    /// below most of its height.
    func body(lead: Double, tail: Double, in size: CGSize) -> CGRect {
        guard !widths.isEmpty else { return .zero }
        let own = width(at: lead)
        guard own > 0 else { return .zero }
        let give = own * 0.12
        let leadLeft = left(at: lead)
        let tailLeft = left(at: tail)
        let minX = max(min(leadLeft, tailLeft), -give)
        let maxX = min(max(leadLeft + own, tailLeft + width(at: tail)), size.width + give)
        let stretch = max((maxX - minX) / own - 1, 0)
        let height = size.height * (1 - min(0.16, stretch * 0.11))
        return CGRect(x: minX, y: (size.height - height) / 2, width: max(maxX - minX, 0), height: height)
    }
}

/// Slate's selector for every control that moves a marker between options
/// (DESIGN.md, Motion): one continuous body in the theme colour that flows to
/// the chosen option, can be dragged as well as tapped, and draws the chosen
/// label's ink itself so the colour changes exactly where the body is.
///
/// Each option takes its label's width plus an equal share of the spare room.
/// The caller sets the height. Labels take their colour from the foreground
/// style, so an item must not set one of its own.
struct LiquidSelector<Item: View>: View {
    let count: Int
    let selectedIndex: Int
    var springs: LiquidSprings = .control
    var trackColor: Color = SlatePalette.fill
    var restColor: Color = SlatePalette.mutedText
    var inset: CGFloat = 4
    /// Report a tap on the option that is already chosen (the dock uses it to
    /// come back from a screen that sits outside its options).
    var reportsReselect = false
    let onSelect: (Int) -> Void
    @ViewBuilder let item: (Int) -> Item
    /// What the body shows for an option, when it differs from the resting
    /// label (the theme slider names the chosen stop only inside the thumb).
    var ink: ((Int) -> AnyView)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var motion: LiquidMotion
    @State private var shown: Int
    @State private var natural: [Int: CGFloat] = [:]
    @State private var dragPosition: Double?
    @State private var lastTranslation: CGFloat = 0

    init(
        count: Int,
        selectedIndex: Int,
        springs: LiquidSprings = .control,
        trackColor: Color = SlatePalette.fill,
        restColor: Color = SlatePalette.mutedText,
        inset: CGFloat = 4,
        reportsReselect: Bool = false,
        onSelect: @escaping (Int) -> Void,
        ink: ((Int) -> AnyView)? = nil,
        @ViewBuilder item: @escaping (Int) -> Item
    ) {
        self.count = count
        self.selectedIndex = selectedIndex
        self.springs = springs
        self.trackColor = trackColor
        self.restColor = restColor
        self.inset = inset
        self.reportsReselect = reportsReselect
        self.onSelect = onSelect
        self.ink = ink
        self.item = item
        _motion = State(initialValue: LiquidMotion(at: selectedIndex))
        _shown = State(initialValue: selectedIndex)
    }

    var body: some View {
        GeometryReader { proxy in
            let size = CGSize(
                width: max(proxy.size.width - inset * 2, 0),
                height: max(proxy.size.height - inset * 2, 0)
            )
            let slots = LiquidSlots(count: count, total: size.width, natural: natural)
            let blob = slots.body(lead: motion.lead, tail: motion.tail, in: size)
            // An index below zero shows no option as chosen (the dock while
            // Profile is open).
            let none = selectedIndex < 0 && dragPosition == nil

            ZStack(alignment: .topLeading) {
                Capsule()
                    .fill(SlatePalette.accent)
                    .frame(width: blob.width, height: blob.height)
                    .offset(x: blob.minX, y: blob.minY)
                    .opacity(none ? 0 : 1)

                // Resting labels, which also take the taps. When the body
                // draws a different label, the resting one is cut away under it.
                labels(slots: slots, height: size.height, measuring: true)
                    .foregroundStyle(restColor)
                    .mask(alignment: .topLeading) {
                        if ink != nil && !none {
                            Rectangle()
                                .overlay(alignment: .topLeading) {
                                    Capsule()
                                        .frame(width: blob.width, height: blob.height)
                                        .offset(x: blob.minX, y: blob.minY)
                                        .blendMode(.destinationOut)
                                }
                                .compositingGroup()
                        } else {
                            Rectangle()
                        }
                    }

                // The same labels in the ink colour, visible only inside the body.
                labels(slots: slots, height: size.height, measuring: false)
                    .foregroundStyle(SlatePalette.onAccent)
                    .mask(alignment: .topLeading) {
                        Capsule()
                            .frame(width: blob.width, height: blob.height)
                            .offset(x: blob.minX, y: blob.minY)
                    }
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                    .opacity(none ? 0 : 1)
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
            .padding(inset)
            .contentShape(.capsule)
            .gesture(drag(slots: slots))
        }
        .background(trackColor, in: .capsule)
        .clipShape(.capsule)
        .onPreferenceChange(LiquidLabelWidths.self) { widths in
            if widths != natural { natural = widths }
        }
        .animation(.easeOut(duration: 0.18), value: selectedIndex < 0)
        .onChange(of: selectedIndex) { _, value in
            guard value >= 0 else { return }
            guard value != shown || motion.target != Double(value) else { return }
            shown = value
            motion.settle(at: Double(value), springs: springs, animated: !reduceMotion)
        }
    }

    private func labels(slots: LiquidSlots, height: CGFloat, measuring: Bool) -> some View {
        HStack(spacing: 0) {
            ForEach(0..<count, id: \.self) { index in
                let width = index < slots.widths.count ? slots.widths[index] : 0
                Group {
                    if measuring {
                        item(index)
                            .padding(.horizontal, 6)
                            .fixedSize()
                            .background {
                                GeometryReader { label in
                                    Color.clear.preference(
                                        key: LiquidLabelWidths.self,
                                        value: [index: label.size.width.rounded(.up)]
                                    )
                                }
                            }
                            .frame(width: width, height: height)
                            .contentShape(.rect)
                            .onTapGesture { choose(index) }
                            .accessibilityElement(children: .combine)
                            .accessibilityAddTraits(index == shown ? [.isButton, .isSelected] : .isButton)
                    } else if let ink {
                        ink(index)
                            .fixedSize()
                            .frame(width: width, height: height)
                    } else {
                        item(index)
                            .padding(.horizontal, 6)
                            .fixedSize()
                            .frame(width: width, height: height)
                    }
                }
            }
        }
    }

    private func drag(slots: LiquidSlots) -> some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                // A mostly vertical move belongs to the page, not the selector.
                if dragPosition == nil {
                    guard abs(value.translation.width) > abs(value.translation.height) else { return }
                    dragPosition = motion.lead
                    lastTranslation = 0
                }
                guard var position = dragPosition else { return }
                let slot = slots.width(at: position)
                guard slot > 0 else { return }
                position += Double((value.translation.width - lastTranslation) / slot)
                lastTranslation = value.translation.width
                dragPosition = position
                // Past either end the body gives a little, then resists.
                let last = Double(count - 1)
                let held = position < 0 ? position * 0.3
                    : position > last ? last + (position - last) * 0.3
                    : position
                motion.hold(at: held, springs: springs, animated: !reduceMotion)
            }
            .onEnded { _ in
                guard let position = dragPosition else { return }
                dragPosition = nil
                choose(Int(position.rounded()))
            }
    }

    private func choose(_ index: Int) {
        let target = min(max(index, 0), count - 1)
        let changed = target != selectedIndex || selectedIndex < 0
        shown = target
        motion.settle(at: Double(target), springs: springs, animated: !reduceMotion)
        guard changed || reportsReselect else { return }
        // The marker moves on the tap itself; the owner hears about it a frame
        // later, so heavy work never holds the marker back.
        DispatchQueue.main.async { onSelect(target) }
    }
}
