![Page 19](images/page_30.png)

parameters when the pole piece is extended from a point that is flush with the top of the frontplate to an extension that equals the gap height.

To help illustrate how this works, *Fig. 0.35* shows a plot of the magnetic flux measurements (Bg curves) that reflect the measurement of motor strength in the middle of the gap. The three curves show the frontplate gap Bg (flux density) in Tesla for 0mm (flush pole), 5mm, and 10mm pole extensions.

A flush 0mm pole is by far the most common design used today and actually has the highest peak reading in the center of the gap. However, the shape of the flux field is not symmetrical on both sides of the gap, and a large amount of stray flux is lost on the topside of the magnet structure.

A 5mm extension, which is half of the frontplate thickness, offers a very symmetrical field. The peak Bg in the gap is slightly less than the 0mm extension because the stray flux is better contained; however, the actual usable energy has increased. As the extension increases past the ideal of half the frontplate thickness, the improved symmetry continues, although the usable energy decreases because of the losses caused by the magnetic having to "drive" the extra metal of the longer polepiece. Loss caused by the extra extension can be minimized by making a cup in the top of the pole to reduce the amount of metal volume (*Fig. 0.2c*).

Other advantages provided by extra pole extension include improved alignment on extreme excursions and most notably an increase in thermal power handling as a result of the extra heatsink area next to the voice coil. The illustrations depicted in *Figs. 0.36* and *0.37* show FEA (Finite Element Analysis) models of a woofer motor cross-section. This shows the intensity of the magnetic field in and around the gap and makes it very easy to see the shape of the flux in the gap. *Figure 0.36* describes a flush pole, while *Fig. 0.37* depicts a pole with the ideal extension. Note the symmetry of the magnetic field above and below the gap on the extended pole as compared to the flush pole.

The data in *Table 0.6* gives the predictions for incrementally increased pole extensions (only the parameters affected by the pole extension changes are shown). Notice how the efficiency and Bl increase as $Q_{ts}$ decreases between 0mm and 5mm. Once you go past this "ideal" half of the frontplate length pole extension (5mm), the relationships reverse and efficiency and Bl decrease as $Q_{ts}$ increases as the length increases to 10mm. *SpeaD* is able to make these predictions because of its ability to model the shape of the flux in and around the gap.

This motor model also allows the program to determine the real "working" $X_{MAX}$ of the speaker. *SpeaD* displays both the commonly used $X_{MAX}$ (based on the measured voice coil $X_{MAX}$ = gap height - [voice coil length/2]) and the working $X_{MAX}$ that is based on the software's magnetic geometry modeling, referred to as $X_{MAX}$f. $X_{MAX}$f is a more realistic representation of how far the coil can travel before the total number of voice-coil "turns" (the "l" in Bl) starts decreasing and the speaker becomes uncontrolled and distorted.

The criteria used for determining the linear operating envelope for a speaker system used elsewhere in this book use a rough approximation of field extension by applying $X_{MAX} + 15\%$, as explained in *Section 1.62, Displacement Limited Acoustic Power Output*. This approximation does not, however, distinguish between more linear configurations such as pole extensions, as Red Rock Acoustic's software is capable of. The $X_{MAX}$f values for the various pole extensions are included in *Table 0.6*.

### 0.80 ADVANCED TRANSDUCER ANALYSIS STUDIES.
There is no doubt that the Klippel Distortion Analyzer is the most significant new tool for loudspeaker characterization to come along in the past few years. Coupling a sophisticated distortion analyzer (*Fig. 0.38*) with a positioning laser (*Fig. 0.39*), Dr. Wolfgang Klippel and his group have given the industry a powerful weapon for understanding the dynamic functioning of woofers, midranges, and tweeters (for more, visit the Klippel website at www.klippel.de, and pay specific attention to the "Know-How" section). The reason this device is so significant is that a small signal linear model such as the familiar Thiele/Small model cannot describe the behavior of electrodynamic loudspeakers at high amplitudes.

Because the standard small signal model doesn't deal with the dynamics of increasing input levels (the LEAP model is an exception and has always dealt with dynamic and nonlinear changes in some fashion), it is oblivious to the thermal variations and the various other nonlinear mechanisms that cause distortion and ultimately limit acoustic output of any device. With its ability to measure dynamic Bl, compliance, inductance, temperature, and a wide variety of other speaker characteristics, the Klippel Analyzer was the perfect choice for a series of short studies that were designed for the 7th Edition of the *Loudspeaker Design Cookbook*. Topics that are illuminated using the Klippel DA include Bl linearity, pole extensions and linearity, shorting rings and distortion, voice coil temperature and motor mass, and voice coil temperature and pole vents.

**FIGURE 0.36:** Shape of the flux in the gap with a flush pole.

**FIGURE 0.37:** Extended pole.

HOW LOUDSPEAKERS WORK

---

![Page 20](images/page_31.png)

LOUDSPEAKER DESIGN COOKBOOK

**FIGURE 0.38:** Klippel DA-2 distortion analyzer hardware.

**FIGURE 0.39:** Klippel test stand with positioning laser and microphone attached.

waveform. Getting them to behave as linear as possible is the task at hand. To that end, Pat Turnmire, CEO of Red Rock Acoustics and author of the *SpeaD* and *RevSpeaD* software (*Section 0.70*), and I put together a short study to illuminate just how it is that transducer engineers such as Mr. Turnmire make speakers operate in a more linear fashion with lower levels of distortion.

The concept was to build up a series of 10" woofers, starting with a purposely nonlinear design and gradually change one "item" per iteration until we have gone from the initially low performance woofer to one that has all the bells and whistles available to improve performance. In total, Pat generated ten woofers for the Bl, pole extension, shorting ring, and voice coil temperature explications that follow. For this section, however, only five of the ten woofers were used. All five used the same frame, cone, surround, four-layer type voice coil wound on the same diameter and thickness aluminum former, the same carbon content steel in the plates, all using Y33 magnet material, and each with a 10mm gap height. The physical specifications for each driver are summarized in *Table 0.7*.

Before using the Klippel analyzer, all of the Thiele/Small parameters were measured using a MLSSA analyzer and the results are summarized in *Table 0.8*.

Looking at *Table 0.7*, you can see that the initial change in woofer samples 1-3 was in voice coil length. From the data given in *Table 0.8*, you can also see some of the criteria used in assembling this group. Obviously, an attempt was made to keep Re and Fs reasonably constant so that all the woofers would have about the same tuning characteristics in a common sealed box volume. However, since all five samples used the same cone, the cone assembly weight (Mmd) would then vary with voice coil size. Because Mmd varied significantly, you will also notice that changes were made in the magnet size to keep Qts values within a fairly narrow range, with the exception of woofer sample #1, which has a somewhat higher Qts than the rest of the group.

Following the initial increase in Xmax in the first three woofers, the next change was in the suspension system, which means that the first three drivers had cupped or elevated type spiders and samples #4 and #5 had a more linear flat type spider that lacked the asymmetrical problems generally associated with the "hinge" on a cupped spider. The last iterative change to make the motor system more linear was with the addition of a pole extension that was equal to one-half of the gap height for woofer sample #5. All the data from *Table 0.8* was entered into the LEAP 5 Enclosure Shop software and the five woofers simulated in a $2\text{ft}^3$ enclosure with 50% fiberglass fill material.

### 0.81 Bl AND COMPLIANCE LINEARITY.
If you have read through and absorbed the first part of this chapter (*Sections 0.21-023*), you know that Bl describes the electromagnetic "horsepower" of a loudspeaker motor, and is essentially the number of turns of wire exposed to the concentrated magnetic field in the gap area. Every loudspeaker designer's goal is to have a woofer that is perfectly linear and works equally well in both directions of travel and faithfully tracks the input signal with zero distortion. For the most part, this speaker doesn't exist, but it is the goal.

To one extent or another, all woofers behave, or misbehave, in a manner that leads to some level of distortion of the input

#### TABLE 0.7
| Sample # | Magnet Dim. | VC Length | Xmax | Spider Type | Pole Extension |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | $110\text{mm} \times 15\text{mm}$ | 14mm | 2mm | Cupped | No |
| 2 | $140\text{mm} \times 20\text{mm}$ | 24mm | 7mm | Cupped | No |
| 3 | $140\text{mm} \times 40\text{mm}$ | 40mm | 15mm | Cupped | No |
| 4 | $140\text{mm} \times 40\text{mm}$ | 40mm | 15mm | Flat | No |
| 5 | $140\text{mm} \times 40\text{mm}$ | 40mm | 15mm | Flat | Yes (5mm) |

#### TABLE 0.8
| | 1 | 2 | 3 | 4 | 5 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| $R_E$ | $3.10\Omega$ | $3.00\Omega$ | $2.96\Omega$ | $3.06\Omega$ | $3.07\Omega$ |
| $F_s$ | 30.49Hz | 30.76Hz | 28.13Hz | 28.19Hz | 27.82Hz |
| $Q_{MS}$ | 6.86 | 6.52 | 6.06 | 7.34 | 7.92 |
| $Q_{ES}$ | 0.78 | 0.65 | 0.58 | 0.58 | 0.56 |
| $Q_{TS}$ | 0.70 | 0.59 | 0.53 | 0.54 | 0.52 |
| $V_{AS}$ | 34.23 liters | 39.51 liters | 36.92 liters | 37.21 liters | 38.20 liters |
| $M_{MD}$ | 88.9 grams | 122.1 grams | 157.3 grams | 157.3 grams | 157.3 grams |
| Bl | 9.47 Tm | 10.56 Tm | 12.07 Tm | 12.22 Tm | 12.44 Tm |

---

![Page 21](images/page_32.png)

The SPL and impedance curves are shown in *Figs. 0.40* and *0.41*, respectively. Again, with the exception of woofer sample #1, the remaining four samples had at least similar performance in the same enclosure volume. However, using computer box simulations, all you can see is the similar box performance, some SPL difference, and some obviously higher voice coil inductance in some of the woofers, but you really don't have much of an idea how these drivers are performing dynamically, and even if you rerun the simulations at higher input voltages, you will only see the relative increase in SPL and changes in overall damping in the woofer/box combination.

The best way to reveal the changes in linearity as we increased the voice coil length, improved the suspension linearity, and increased the forward fringe field linearity by adding a pole extension is using the Klippel Analyzer. Because this is a very expensive test instrument that ranges from $20,000 to $30,000, it is unfortunately out of the reach of most amateur designers, and even many smaller loudspeaker manufacturers. However, Dr. Klippel's group has graciously provided a complete Klippel setup that Patrick Turnmire and I use for driver testing in *Voice Coil* magazine, product reviews in *Car Audio and Electronics* magazine, and for this section of the 7th Edition of the *LDC*.

I chose three graphs from the selection of data produced by the Klippel Analyzer; Bl (X), Kms (X), and Le (X). This is the same basic curve set that I use in the Test Bench section of *Voice Coil* each month. Bl (X) is a dynamic depiction of Bl change as the woofer reaches the extremes of excursion in both the forward and the rear directions of travel. Kms (X) is the stiffness of the suspension curve and is the mathematical inverse of a compliance curve. The Le (X) curve shows the changes in inductance that occur as the voice coil travels in both directions.

Testing woofers using the Klippel Distortion Analyzer involves running a noise stimulus with a pre-programmed series of level changes. This test takes approximately 5-10 minutes per driver and yielded the Klippel data curves for the five woofer samples as follows:

| | Bl (X) | Kms (X) | Le (X) |
| :--- | :--- | :--- | :--- |
| Sample #1 | 0.42 | 0.43 | 0.44 |
| Sample #2 | 0.45 | 0.46 | 0.47 |
| Sample #3 | 0.48 | 0.49 | 0.50 |
| Sample #4 | 0.51 | 0.52 | 0.53 |
| Sample #5 | 0.54 | 0.55 | 0.56 |

Looking at the set of curves for woofer sample #1, you can see that the Bl curve has a rather pointed shape and falls off quickly in both directions of cone travel. Actually, this is very similar to what you often see in high efficiency pro sound woofers where excursion is not as important of an issue as efficiency. Both the Bl (X) and Kms (X) curves show a forward offset of the voice coil, which while not extreme in this instance, the goal is generally to have these curves centered at the rest position" and symmetrical in both directions. However, offsets in the voice coil at rest position can be both good and bad. In most circumstances, an offset voice coil only produces additional signal distortion, while a deliberate offset that compensates for an asymmetrical magnetic field can actually improve a woofer's performance.

The Bl curve for woofer sample #1 is actually quite symmetrical, but the cupped spider Kms (X) curve shows an obvious lack of symmetry with different curve slopes for the rear direction of travel compared to the forward direction. While this is typical of cupped (elevated) spiders, it should be said that it is also possible to configure this type of spider such that its compliance is more symmetrical.

Another byproduct of Klippel analysis is for the software to generate excursion limitations for the individual Bl, compliance, and inductance components that define how these components contribute to a particular level of distortion. Because the woofers produced for this test are all basically $4\Omega$ subwoofers, the criterion for a 20% distortion level is Bl decreasing to a minimum of 70%, compliance decreasing to a minimum of 50%, and inductance decreasing to a minimum of 10%. A reasonable criterion for subwoofers is 20% distortion, which is subjectively not readily discernible at frequencies below 100Hz. For full-range devices, the criteria

**FIGURE 0.40:** Computer box simulation SPL curves for woofer samples #1-5 (A = woofer 1; B = woofer 2; C = woofer 3; D = woofer 4; E = woofer 5).

**FIGURE 0.41:** Computer box simulation impedance curves for woofer samples #1-5 (A = woofer 2; B = woofer 4; C = woofer 3; D = woofer 1; E = woofer 5).

HOW LOUDSPEAKERS WORK
