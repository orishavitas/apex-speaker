# Chapter 0: How Loudspeakers Work

## 0.10 ELECTRODYNAMIC SPEAKERS

![Page 3](images/page_14.png)

This Seventh Edition of the *Loudspeaker Design Cookbook*, like its predecessors, aims to describe the operation, application, and measurement of electrodynamic loudspeakers and their associated enclosures and crossover networks. Electrodynamic drivers, the woofers, midranges, and tweeters found in the vast majority of loudspeakers are all based on the same basic concept: a diaphragm set in motion by the mechanical movement of a modulated electromagnetic field. As Mark Gander of JBL put it, "To make sound, you must move air."¹

This mechanism is analogous to the electric motor, the rotating armature of a motor being replaced by the moving coil system of a speaker. *Figure 0.1* illustrates a cutaway view of a typical dynamic moving coil loudspeaker. As current is applied to the voice coil, an electromagnetic field is produced at right angles to the flow of current and to the permanent magnetic field. The resulting mechanical force causes the cone or dome diaphragm to move in a motion perpendicular to the gap field and consequently activate the air on either side of the diaphragm.

Three separate but interrelated systems operate in unison in a functional electrodynamic driver:
1. The Motor System: composed of the magnet, pole piece, frontplate/gap, and voice coil.
2. The Diaphragm: usually a cone and dust cap or a one-piece dome.
3. The Suspension System: made up of the spider and surround.

### FIGURE 0.1: Woofer diagram
(Diagram showing: FRAME, SURROUND, CONE, DUST CAP, GAP, SPIDER, VOICE COIL, POLE PIECE, VENT, FRONT PLATE, MAGNET, BACK PLATE)

## 0.20 THE MOTOR SYSTEM

The motor assembly is composed of five basic parts. These include the frontplate and pole piece, which together form the gap, the magnet, the voice coil, and the backplate. The backplate, frontplate, and pole piece are made from a highly permeable material, such as iron, which provides a path for the magnetic field of the magnet. The magnet is usually made of ceramic/ferrite material and shaped like a ring. The magnetic circuit is completed at the gap, causing an intense magnetic field to exist in the air space between the pole piece and the frontplate.

If an AC current is applied to the voice coil in the form of a sine wave at some given frequency, such as 60Hz, the flow of current in one direction on the positive half of the cycle will produce voice coil motion in one direction. When the current flow reverses on the negative half of the cycle, the polarity of the coil field reverses, and the motion of the voice coil changes direction as a consequence of the alternately attracting and repelling of the two fields.

In order to accurately reproduce the motion induced by the sine wave, the voice coil has to move equally in both directions through the gap. For this to happen, it is important for the magnetic field to be as symmetrical as possible, so that motion in one direction will be applied with the same equal force as motion in the other direction. If this were not so, distortion of the signal would result.

If the flow of magnetic flux was confined only in the narrow space across the air gap, field symmetry would be assured and not be of concern. However, the magnetic lines of force "overflow" the gap area and produce stray fields on either side of the gap, known as fringe fields. Several methods are commonly used to ensure the symmetry of the fringe field, and are illustrated in *Fig. 0.2*. The straight pole piece in *Fig. 0.2a* illustrates an uneven fringe field caused by the non-symmetrical gap structure. Although adequate for many applications, this would be the least desirable method of construction. *Figure 0.2b* shows a symmetrical fringe field being created as the result of an undercut pole piece. *Figure 0.2c* depicts the effect of an angled pole piece on the fringe field,² which, like the undercut type, results in a more symmetrical fringe field.

The mechanical force developed by the current flowing through the voice coil is represented by the term "Bl." B x l is the force produced by a given number of turns (feet) of wire, l, being subjected to a given flux density per square centimeter, B.³ Bl is a measurement of motor strength and is expressed in Tesla Meters/Newton. Directions on how to measure Bl are described in *Chapter 8, Loudspeaker Testing*.

---

![Page 4](images/page_15.png)

## 0.21 GAP GEOMETRIES AND Bl.

Two different basic gap/coil geometries are used in loudspeakers, the underhung voice coil and the overhung voice coil. Of the two formats, illustrated in *Fig. 0.3*, the overhung coil is by far the most common. The distance labeled $X_{MAX}$ in the diagram represents the distance over which the coil can travel in one direction and maintain a constant number of turns in the gap. $X_{MAX}$ can be calculated by taking the voice coil length, subtracting the air gap height, and dividing by 2.

*Figure 0.4* shows the graphic comparison of Bl change with increasing excursion between the two gap geometries (this diagram represents movement of the voice coil in one direction through the gap). As increasing voltage is applied to the speaker, the coil moves further and further out of the gap, the number of turns of wire in the gap decreases, and the total Bl motor strength decreases. A speaker is said to be operating in a linear fashion if the number of turns in the gap is constant, and in a non-linear fashion if the number of turns in the gap is decreasing and changing.

### FIGURE 0.2: Fringe field effects for different pole geometries.
(Diagrams showing A: straight, B: undercut, C: angled)

### FIGURE 0.3: Overhung and underhung coil geometries.
(Diagrams illustrating Overhung Voice Coil and Underhung Voice Coil with $X_{MAX}$ and gap height H labeled)

### FIGURE 0.4: Comparison of Bl response for different coil geometries.
(Graph showing Bl vs Voice Coil Travel - mm for Overhung and Underhung voice coils)

The underhung coil gives extreme linearity over a short distance, but generally has lower Bl than the overhung coil (due to the increased gap height and requirement for a greater magnetic field) and because of the short coil, a lower voice coil mass. The overhung arrangement has the advantage of reasonably good linearity and better efficiency (even with greater coil mass), which accounts for its popularity among manufacturers.

Different combinations of gap height and voice coil length will give the same $X_{MAX}$ number, but behave quite differently in terms of nonlinear (beyond $X_{MAX}$) behavior. For example, a 12mm voice coil length and an 8mm gap have the same $X_{MAX}$, 2mm, as an 8mm voice coil length and a 4mm gap height. Although the $X_{MAX}$ of these geometries is identical, the ratio of gap height to $X_{MAX}$ is quite different, 4:1 in the case of the 12mm voice coil, and only 2:1 in the case of the 8mm voice coil. This ratio governs the rate at which Bl decreases as the coil rides out of the gap.

The curves in *Fig. 0.5* illustrate the variation in nonlinear behavior for geometries with the same $X_{MAX}$ but with different ratios of gap height to $X_{MAX}$, as in the above example (from conversations with Chris Strahm, President of LinearX Systems and author of the Loudspeaker Enclosure Analysis Program, a/k/a LEAP). Looking at the diagram, Bl starts to gradually decrease beyond $X_{MAX}$ to a point which is about two times $X_{MAX}$ (double $X_{MAX}$) and then dramatically decreases. When the ratio of air gap height to $X_{MAX}$ is large, the rate of Bl decrease is slower than when the ratio is low. At the furthermost limits of excursion, at the point where the coil is riding a large distance out of the gap, increased excursion does not change Bl significantly, and the...

---

![Page 5](images/page_16.png)

### FIGURE 0.5: Comparison of Bl response with identical $X_{MAX}$ and different coil/gap dimensions.
(Graph showing Bl vs Voice Coil Travel - mm with curves for High Gap/Xmax Ratio and Low Gap/Xmax Ratio)

...curve becomes more shallow and levels out as it approaches zero.

Although Bl tends to decrease slowly up to about twice the $X_{MAX}$ distance, measurable distortion begins much sooner. In terms of distortion, the peak displacement limit of a moving coil can generally be taken as the $X_{MAX}$ travel distance plus about 15%. Maximum excursion can be determined with a distortion analyzer setup to measure third-harmonic distortion as increasing voltage is applied to the voice coil. As excursion increases and the limits of $X_{MAX}$ are exceeded, the third-harmonic distortion product increases. The $X_{MAX}$ + 15% point will tend to coincide with an increase in third-harmonic distortion to a level of about 3%.¹

## 0.22 SHORTED TURNS AND FARADAY LOOPS.

The current induced motion of the voice coil also causes an additional current flow, in the opposite direction of the drive current, which is known as back EMF (electromotive force). This EMF current is induced in the voice coil as it acts like the armature of a generator. This effect, along with the AC field generated by the program drive current in the voice coil, causes modulation of the magnetic gap field. This phenomenon, identified by W. J. Cunningham in 1949,⁴ results in significant second-order harmonic distortion. Further investigation of this effect has shown that the modulation of the field is different depending on which direction the coil is traveling through the field. It is a non-symmetrical effect.⁵

This nonsymmetrical phenomenon occurs in part because the pole piece, acting like a transformer core, is coincident with the coil throughout its rearward travel, and only partially coincident on the forward travel of the coil as it excurs beyond the limits of $X_{MAX}$. It has also been suggested that the voice coil flux interacts with and modifies the shape of the fringe field. This observation, at least in part, explains the benefit gained from push/pull configurations discussed in *Chapters 1 and 2*.

The most obvious solution is to use a sufficiently high level of permeability in the iron next to the voice coil so the metal is always saturated, which results in negligible modulation of the magnetic circuit. This technique is not often used because high permeability metals are relatively expensive. The most common technique devised to counteract this field modulation/eddy current problem is known as a shorted turn, or Faraday loop. Shown in *Fig. 0.6*, the application of the shorted turn has several variations, but all accomplish the same task by generating a field equal and opposite to fields induced by the voice coil. *Figure 0.6a* takes the form of a conductive coating, such as copper, over the pole tips; *Fig. 0.6b* shows a copper cap over the pole piece; *Fig. 0.6c* has a copper cylinder surrounding the pole piece;² and *Fig. 0.6d* illustrates the positioning of a shorted ring (flux stabilizer ring), sometimes made of aluminum, around the base of the pole piece.

The shielded pole piece method has the added benefit of causing a decrease in effective voice coil inductance, which results in a rise in high frequency response. The location and amount of shielding can be juggled to control midband and upper range driver response. The shorted ring at the base of the pole piece acts to reduce second-harmonic distortion, like the shielded pole methods, but does not affect the voice coil inductance and upper range response nearly as much. Although decreasing distortion is one of the benefits of the shorted turn method, controlling the mid and upper range frequency response behavior is more often the consideration.

*Figure 0.7* illustrates the upper frequency response changes from using a T-pole and copper-shorting ring. The comparison is of the same driver, a Bravox 5.5" poly cone woofer; with and without the T-pole/shorting ring combination⁶. Note that the response of the T-pole/shorting ring version begins rising...

### FIGURE 0.6: Comparison of different shorted turn configurations.
(Diagrams A, B, C, D showing various shorting ring/cap placements)

---

![Page 6](images/page_17.png)

...above 500Hz and has as much as 3-4dB greater SPL than the version without the pole enhancements due to the reduction in losses from induced eddy currents. *Figure 0.8* depicts the same comparison at 30° off-axis, showing the effect to be not only across the bandwidth above 500Hz, but through the entire radiation angle of the driver, as would be expected from an effect that lowered the voice coil inductance.

## 0.23 VOICE COILS—FORMER MATERIALS AND WINDING CONFIGURATIONS.

Voice coils can be wound on a variety of materials, each having an effect not only on the T/S parameter set for a given driver, but also on the upper frequency response. There are two basic types of former materials used for loudspeakers, conductive and non-conductive. Conductive formers are by far the most common and are made from thin sheets of aluminum or Duraluminum (Duraluminum has a higher strength to avoid such voice coil problems as neck deformation during long excursions). Since aluminum is an electrically conductive material, it develops eddy currents in the same fashion as the parts of the motor system (plates and pole). These parasitic "currents" cause losses that are reflected in terms of heat and distortion.

Aluminum formers are not a continuous cylinder, but have a small slit along the length of the former such that it does not act as a shorting element (incidentally, removing the slit and using a continuous aluminum loop does not have the same effect as a shorting ring, although it does lower $Q_{MS}$ by about 10%). A non-shorting conductive former performance differs in two important aspects when compared to non-conductive former materials such as fiberglass or Kapton™ (a proprietary high temperature plastic material introduced by Dupont). The...

### FIGURE 0.7: On-axis comparison of two 5.5" woofers, with and without copper shorting ring and shaped T-pole (solid = motor with shorting ring and T-pole).

### FIGURE 0.8: Same as Fig. 0.7, but 30° off-axis.

### FIGURE 0.9: On-axis comparison of two 5.5" woofers, one with an aluminum voice coil former and one with a Kapton voice coil former (solid = woofer with aluminum voice coil former; dash = woofer with Kapton voice coil former).

### FIGURE 0.10: Same as Fig. 0.9, but 30° off-axis.

### FIGURE 0.11: On-axis comparison of two 5.5" woofers, one with a two-layer voice coil, and one with a four-layer voice coil (solid = 2L voice coil; dot = 4L voice coil).

### FIGURE 0.12: Same as Fig. 0.11, but 30° off-axis.

---

![Page 7](images/page_18.png)

...primary difference is that $Q_{MS}$ (mechanical "Q") numbers using conductive formers are generally lower in the 2-4 range compared to non-conductive types. For non-conductive formers, higher $Q_{MS}$ numbers between 4 and 12 are typical (the eddy current losses cause the $Q_{MS}$ to be lower in conductive formers). Since non-conductive formers do not exhibit the induced eddy current problem, they also exhibit somewhat lower distortion.

The other performance difference between conductive and non-conductive former materials occurs in the upper frequency response. *Figure 0.9* depicts the comparison of two nearly identical Bravox 5.5"⁶ woofers with identical cones, suspensions and motor structures, except that one driver has a Duraluminum voice coil former and the other has a Kapton former. As can be seen, the woofer with the Kapton former has 1-2dB greater output above 1.5kHz. *Figure 0.10* shows the same comparison but at 30° off-axis showing the effect to be somewhat more prominent. Again, this is due mostly to the difference in eddy current losses of the two materials. It should also be noted that part of this effect is due to mass differences (i.e., Kapton is a lighter material than Duraluminum).

The other notable response variation caused by voice coils is the manner in which they are wound. Obviously, larger voice coils with longer winding lengths have more turns of wire and hence greater inductance that will rolloff a driver's upper frequency response in the same fashion as a series inductor in a crossover. While there are different voice coil inductances for every possible combination of turns of wire and diameters of the former and pole piece, the biggest generalized difference in driver inductance is dependent on the number of layers of wire wound on to the former. The most common layer formats in woofers are two-layer and four-layer. Four-layer formers are frequently used on subwoofers to achieve the required Bl for the target response.

However, this can also be looked at in terms of upper frequency response control. *Figure 0.11* shows two nearly identical drivers, both Bravox 5.5" woofers⁶, with the same motor, cone, and suspension, but one woofer with a two-layer voice coil, and the other using a four-layer coil (see *Fig. 0.12* for the same comparison at 30° off-axis). As can be seen, the woofer with the four-layer coil has a much lower frequency low-pass rolloff (-3dB at 2.5kHz) than the two-layer version (-3dB at 4.5kHz). Some manufacturers have developed two-way loudspeakers by taking advantage of this effect and controlling the inductance of a four-layer voice coil to produce a natural low-pass rolloff that will work with a particular tweeter. By doing this, the woofer does not require a separate low-pass crossover filter section and can be operated "wide open" with a crossover comprised of just the tweeter high-pass filter. I did a series of two-way prototypes for MB Quart several years ago using a 5.5" Bravox woofer and a 13mm MB Titanium tweeter. One prototype used a woofer with four-layer coil and a 3kHz mechanical rolloff and the other a standard two-layer coil with a higher rolloff. Both crossovers were computer optimized, but the four-layer woofer prototype had no low-pass filter on the woofer and a third-order high-pass topography on the tweeter while the two-layer woofer prototype had a second-order low-pass on the woofer and a third-order high-pass filter on the tweeter. In a subjective comparison between these two prototypes, once the levels were adjusted, both models sounded quite good and were very comparable in overall sound quality with the advantage that the four-layer model was cheaper to manufacture and had fewer parts in the crossover. The other difference was that the four-layer model was lower in overall efficiency by 2-3dB due to the extra weight in the four-layer coil, and therein lies the tradeoff.

## 0.30 THE DIAPHRAGM.

Explaining the physics of speaker cones generally begins with the theoretical discussion of the radiation of an infinitely rigid piston pushing against the air. The transference of motion from the piston to the air would be bounded, in terms of frequency, at the low end of the spectrum by its resonance frequency (below which its ability to transfer energy is limited by mechanical constraints), and the upper frequency limit by the nature of the radiation impedance of the air. Air has resistance to motion, radiation impedance, which decreases with frequency to a point where any additional increase in frequency will be met with the same amount of resistance.

This upper frequency point below which energy transfer will exhibit a steady decrease is a function of both the nature of the radiation impedance of air and the radius of the radiating surface. Smaller radiating surfaces can reproduce higher frequencies than larger radiating surfaces, a fact of nature which accounts for the advent of specialized speakers which cover different frequency ranges.

Real-world cones are not infinitely rigid and will flex to some degree depending upon the characteristics of the material from which they are constructed. Cone flexing has a critical effect upon the high frequency efficiency, SPL response, and polar response of a driver. While different materials have different degrees of stiffness and transmit vibration at different speeds internally, they all tend to produce the same types of flexing, usually referred to as "modes."

### 0.31 CONE RESONANCE MODES.

Two mode classifications, radial and concentric, are used in analyzing speaker cone vibration, depicted in *Fig. 0.13* (after Beranek with changes). Radial modes extend from the cone center to the edge, occurring mostly at low frequencies and considered secondary in nature. Concentric modes form a collection of waves or ripples that spread outward from the center of the cone. These concentric modes, made visible using holographic techniques, look similar to what...

### FIGURE 0.13: Cone vibration modes.
(Diagrams showing: RADIAL CONE MODES, CONCENTRIC CONE MODES, COMBINATION OF RADIAL AND CONCENTRIC MODES)
