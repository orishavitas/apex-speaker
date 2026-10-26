# Loudspeaker Design Cookbook - Transcription Part 3

## Page 13
![Page 13](images/page_24.png)

availability of software that can predict parts specifications for building woofers, transducer engineering will become less of a cut-and-try game and more of a computer game, but that is the era in which we live.

Armed with SpeaD and its counterpart, Reverse SpeaD, I present the following short tutorial that will show how the various motor and cone assembly parts in a woofer change as the box design requirements change. The enclosure designs that I consider all use a 12" woofer, with the first computer-designed woofer optimized for a moderate 2.0ft³ sealed box.

The next design shows the motor and cone part changes required to optimize the same woofer to work into a 2.0ft³ vented box. This is followed by the motor/cone changes for the woofer to function in a 2.0ft³ sealed rear-chamber bandpass enclosure. The last simulation shows the motor and cone part requirements for the same 12" woofer to work in a compact 0.75ft³ sealed box.

All the data and graphs (and some of the text) used for this tutorial were provided by Red Rock Acoustics and specifically by Red Rock's CEO, Pat Turnmire, who happens to be one of those "hard to find" transducer engineers.

### 0.71 WOOFER DESIGN FOR SEALED ENCLOSURES.

This first example generates the woofer parts specifications for a sealed box. Specifications for this project begin with the box performance criteria. For the purposes of this tutorial, imagine that you are the speaker engineer in a small car audio company and the marketing department asks you to develop a new sealed box 12" subwoofer.

The criteria you are given are pretty limited. Marketing department research reveals that a 12" car audio subwoofer producing an f₃ of 40Hz in a 2.0ft³ box, handling 200W RMS, incorporating a rubber surround and polypropylene cone, and with a box QTC of 0.9 would do well in the marketplace. In other words, a moderate-sized sealed box 12" car sub with a fairly warm sound to the bottom end and enough excursion to become loud and low (given the lift in a car compartment, 40Hz is low cutoff frequency, but see Chapter 11 for details on that). Table 0.1 summarizes all of this information, including assumptions about XMAX for a 12" subwoofer that would need to come from experience or observation and some help estimating QMS using one of the SpeaD utilities.

The design procedure begins with generating the T/S parameter set that will produce the results required by the marketing department's product definition. SpeaD's reverse box synthesis section, Reverse SpeaD, is designed to do just that. Looking at the data in Table 0.1, the only target parameter that Reverse SpeaD needed that wasn't immediately obvious was the MMD, which represents the total moving mass (less air load—with air load this is called MMS) of the speaker.

MMD for any given driver is a combination of four items: the cone weight; half of the surround edge weight; voice-coil weight (former and wire); and the various miscellaneous weights that include the dust cap, spider, and adhesives used in putting together the cone assembly. The cone and surround weight are relatively easy to find. The poly cone and attached rubber surround used in this example weigh in at 72 grams after cutting off half of the edge.

The voice-coil assembly weight is the next part of the MMD equation. From experience (note that experience still plays a big part in transducer design, even with sophisticated software and a fast computer), a designer knows that a 2" diameter voice coil would likely yield the thermal power handling to achieve the target of 200W established by the marketing department. Experience also suggests that a four-layer coil is required to produce the extra Bl needed to push around a heavy 12" woofer cone.

Given the 8mm XMAX of Table 0.1 and the educated guess that the frontplate thickness would be in the range of 10mm, the total voice-coil winding height would be 26mm (voice-coil winding height = frontplate thickness + 2[XMAX]). You can then calculate the target voice-coil weight by using a utility provided in Reverse SpeaD. In this case the 2" diameter four-layer voice coil with a 26mm winding height and a 3.5Ω DCR should weigh in the vicinity of 51 grams. Adding the cone weight of 72 grams to the estimated voice-coil weight of 51 grams plus another 17 grams for the dust cap and other miscellaneous weight, you get a target MMD of 140 grams.

After you enter all of this information into Reverse SpeaD, the program automatically calculates the parameter set shown in Fig. 0.25. As you can see, the final speaker would be fairly efficient with an SPL of 89.66dB at 2.83V.

After you have determined the woofer parameter targets, the next step is to use the main body of the SpeaD software to come up with a set of woofer com-

**TABLE 0.1: SEALED BOX CRITERIA.**

| Parameter | Value | Notes |
| :--- | :--- | :--- |
| REVC | 3.5Ω | Standard for a 4Ω car audio woofer |
| SD | 0.049m² | Standard 12" cone area |
| QMS | 10 | An estimate based on the voice coil and cone type and the data chart in the SpeaD help system |
| Box volume | 2.0ft³ | Given by marketing |
| QTC | 0.9 | A compromise between efficiency and a slightly "warm" bottom end that car audio enthusiasts like |
| MMD | ???? | |
| XMAX | 8mm | The upper range excursion for most 12" subwoofers |
| f₃ | 40Hz | Given by marketing |

---

## Page 14
![Page 14](images/page_25.png)

ponent parts that will produce these parameters. Step 1 is to use the SpeaD Voice Coil optimizer to finalize the voice-coil specification, entering voice-coil data already produced with the Reverse SpeaD Coil Tool into the Coil Optimizer (four layer coil, 2" ID, Kapton former, 26mm winding height, and a DCR of 3.5Ω). The Coil Optimizer calculates that the wire size would be 25 AWG and the actual winding height with a 3.5 DCR would be 24.767mm—close enough to the target of 26mm (Fig. 0.26).

The next step is the motor design. Again, experience would lead a transducer engineer to start with a 30 oz magnet that had likely been successfully used on other similar 12" woofer projects. The dimensions for a 30 oz magnet are 120mm outside diameter x 20mm thick x 60mm inside diameter. As a rule of thumb, the ideal frontplate and backplate diameter is generally calculated to be the magnet OD less the frontplate thickness—in this case, 110mm would be perfect.

Entering 110mm for the frontplate OD, 10mm for the thickness, and then using SpeaD's recommended inside diameter of 54.25mm, you've finished the frontplate design. To do this, the program takes into consideration the diameter of the coil, former thickness, and winding depth plus a typical gap spacing that would produce maximum Bl and still have room for mechanical travel.

The backplate/polepiece is just as simple. Beginning any design, a designer can always assume the backplate to be the same OD and thickness as the frontplate. For the polepiece, a standard pole diameter of 48.95mm would give an appropriate amount of clearance between the pole and the voice-coil former inside diameter.

Also incorporated into this speaker motor design is a 5mm extended polepiece (see the later section on extended polepiece dynamics) that would, according to the SpeaD Help menu, be ideal for the 10mm frontplate thickness. The extended pole not only provides for more linear flux in both movement directions for the voice coil, but also provides a guide for the coil on extreme excursions that take the coil completely out of the gap. The extended pole prevents the possibility of the voice coil jamming into the front plate and causing catastrophic failure. The last detail is a 25mm vent hole in the polepiece that was added for cooling and pressure release behind the solid dust cap.

After you enter all of this data into the software, the program immediately reveals a substantial amount of information about the motor design. First, each of the metal parts—frontplate, backplate, and

**FIGURE 0.25:** Calculating parameters with Reverse SpeaD.
**FIGURE 0.26:** SpeaD Voice Coil Optimizer (left).
**FIGURE 0.27:** Motor design using SpeaD (right).

---

## Page 15
![Page 15](images/page_26.png)

polepiece—has a "saturation bar," an indicator that shows to what degree the part is magnetically saturated. Normally, the most efficient (and least expensive) way to design woofers is with the components at or just below their saturation levels. In this case, none of the metal parts in the motor simulation was close to saturation, which shows that the motor was not losing any energy because the parts were too thin (oversaturated).

Next, from the drop-down box in Fig. 0.27, you can see that the gap flux has a reading of 0.56 Tesla (Bg). SpeaD also indicates that the minimum backplate thickness is less than 6mm for this design. This means that if the motor design meets the required goals, the company could save money in parts costs by reducing the backplate thickness from 10mm to 6mm.

At this point, most of the information for the Soft Parts section of SpeaD is available and can be entered into the program in order to get the final result. This includes the cone area (SD) of 0.0491m², the cone f₀ of 41Hz supplied by the manufacturer (cone f₀ and the weight of the cone can be used to define the cone compliance), the weight of half the surround and cone measured at 72 grams, plus the estimated miscellaneous 17 grams of dust cap/adhesive mass. The spider deflection number comes from the spider supplier for a standard 6" diameter spider with a 2" coil opening. Deflection for this spider was 0.5mm using a 50 grams test weight. The QMS value of ten that came from the SpeaD help system is the last input value required.

The motor parts data and the soft parts data entered into the program produced the T/S parameter set in Table 0.2. From this it is obvious that at least one problem still exists, as indicated by the starting data, which shows that the f₀ prediction is about 34Hz, 6Hz lower than the target f₀ of 40Hz. Since the easiest way to raise f₀ is to decrease the spider compliance (use a stiffer spider), the first change is to experiment with the spider deflection number.

After a few trials, a deflection of 0.15 caused the parameter set to fall in line with the original targets as depicted in Fig. 0.28. After this analysis, a designer would be ready to order parts and build a prototype woofer with a high degree of certainty that this design will produce the required result.

### 0.72 WOOFER DESIGN FOR VENTED ENCLOSURES.

Keeping with the theme of being a transducer engineer in a small car audio company, imagine you just finished prototyping the sealed box product when the marketing department decides that maybe a 2ft³ vented box with an f₃ about half an octave lower in frequency would be better. Marketing also wishes to consider doing a bandpass speaker in the same size box as well and has asked for two new prototypes to test.

The first thing is to check the viability of using the current woofer prototype in a 2ft³ vented box. Even though the QTS is much too high (see Chapter 1, Section 1.40 Woofer Selection and Enclosure Construction), running a LEAP simulation using the sealed box woofer parameters and a 2ft³ box tuned to 40Hz confirms this (Fig. 0.29). The 7dB peak in the response indicates very poor damping for the

**TABLE 0.2: SEALED BOX MOTOR AND SOFT PARTS.**

| Target Parameters | Starting Data | 1st Iteration |
| :--- | :--- | :--- |
| REVC | 3.5 | 3.5 |
| f₀ | 33.77 | 39.21 |
| QTS | 0.7404 | 0.8495 |
| QES | 0.7996 | 0.9283 |
| QMS | 10 | 10 |
| VAS | 51.47 | 38.18 |
| Bl | 11.64 | 11.64 |
| XMAX | 139.86 | 139.86 |
| SPL 2.83V | 89.46 | 89.46 |

**Key Parts**
Spider deflection: 0.5mm @ 50g (Starting), 0.15mm @ 50g (1st Iteration)

**FIGURE 0.28:** Final woofer parameters in SpeaD.
**FIGURE 0.29:** LEAP simulation for sample woofers.
**FIGURE 0.30:** Sample vented woofer parameters using Reverse SpeaD.
