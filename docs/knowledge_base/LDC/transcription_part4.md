# Loudspeaker Design Cookbook - Transcription Part 4

![Page 16](images/page_27.png)

woofer/box combination and is unacceptable.

Using Reverse SpeaD and a little computer "cut and try," I achieved a moderately damped B3 type response by lowering the $f_s$ target to 30Hz (*Fig. 0.30*). Marketing liked the idea of the sub going lower in frequency. I entered the Reverse SpeaD information into the main body of the program and after three iterations of changes produced the data presented in *Table 0.3*.

The first step, as with the sealed box design, is to adjust the compliance to match its target value. This is again easily accomplished by adjusting the spider deflection and making it stiffer. Decreasing the spider compliance with a new deflection of 0.25mm raised the $f_o$ sufficiently to match the new vented box target.

The next step is to increase Bl to a level that lowers the $Q_{ts}$ to its target value. Increasing the magnet OD is the most obvious approach to try initially. The next size available is 140mm. Along with the increase in the magnet OD, it is necessary to also increase the frontplate and backplate OD to match the magnet.

This 140mm magnet change brought the $Q_{ts}$ very close to the target, but $Q_{ts}$ is still too high. Increasing the magnet OD beyond 140mm is one possible technique that could be used to increase Bl enough to achieve the target $Q_{ts}$, but an alternate approach is to try increasing the magnet thickness. This would give the voice coil additional travel in the rear direction of coil travel and help prevent "bottoming" (the back of the voice-coil former slamming into the backplate on a rearward stroke).

Given the excursion potential of all vented loudspeakers below the box tuning frequency, this would definitely be an appropriate choice, especially given the somewhat well-known fact that car audio customers are notorious for playing their systems at high volume levels with the bass full up. A change from 20mm to 25mm in the magnet thickness increased Bl sufficiently to provide an exact match with the target $Q_{ts}$.

### 0.73 WOOFER DESIGN FOR BANDPASS ENCLOSURES.

Bandpass designs are more complex and require more information to define the targets in Reverse SpeaD. Typical additional specs (besides a total volume of $2ft^3$ and an $f_b$ in the vicinity of 40Hz) include a flat response with 0dB ripple and a -3dB high-frequency cutoff of between 80 and 90Hz. After entering the appropriate data, Reverse SpeaD calculated the parameter targets for a box with a $0.77ft^3$ rear volume and a $1.2ft^3$ front volume tuned to 60Hz (*Fig. 0.31*).

The woofer described has a driver efficiency of 90.6dB at 2.83V and a system gain for the bandpass enclosure of 4.25dB. Entering this data into the main program menu results in the data displayed in *Table 0.4*, which includes the four iterations of driver part variations to achieve the final result.

**FIGURE 0.31: Sample bandpass design using Reverse SpeaD.**
**FIGURE 0.32: LEAP bandpass simulations.**

#### TABLE 0.3: VENTED BOX DESIGN

| Target Parameters | Starting Data | 1st Iteration | 2nd Iteration | 3rd Iteration |
| :--- | :--- | :--- | :--- | :--- |
| $R_{EVC}$ | 3.5 | 3.5 | 3.5 | 3.5 | 3.5 |
| $f_o$ | 36.23 | 33.77 | 36.20 | 36.20 | 36.20 |
| $Q_{ts}$ | 0.4381 | 0.7404 | 0.7859 | 0.4740 | 0.4210 |
| $Q_{es}$ | 0.4582 | 0.7996 | 0.8572 | 0.4976 | 0.4395 |
| $Q_{ms}$ | 10 | 10 | 10 | 10 | 10 |
| $V_{AS}$ | 44.53 | 51.47 | 44.79 | 44.79 | 44.79 |
| Bl | 15.94 | 11.64 | 11.64 | 15.28 | 16.26 |
| $X_{MAX}$ | 8.00 | 7.38 | 7.38 | 7.39 | 7.39 |
| $M_{md}$ | 140.00 | 139.86 | 139.86 | 139.9 | 139.90 |
| SPL 2.83V | 92.17 | 89.46 | 89.46 | 91.82 | 92.36 |

**Key Parts**
*   Spider deflection: 0.5mm @ 50g (Start), 0.25mm @ 50g (1st), .25mm @ 50g (2nd), .25mm @ 50g (3rd)
*   Magnet OD: 120 (Start), 120 (1st), 140 (2nd), 140 (3rd)
*   FP & BP OD: 110 (Start), 110 (1st), 130 (2nd), 130 (3rd)
*   Magnet TH: 20 (Start), 20 (1st), 20 (2nd), 25 (3rd)

---

![Page 17](images/page_28.png)

main program menu results in the data displayed in *Table 0.4*, which includes the four iterations of driver part variations to achieve the final result.

The first iteration required a new surround (lower cone $f_o$). Instead of stiffening the suspension as was done with the spider change for the vented design, what was needed was a surround that was less stiff than the original design. I used a medium stiffness (also called durometer) material to achieve a cone $f_o$ of 35Hz. This brought the woofer $f_o$ to 29.62Hz, just a hit higher than the target. A minor adjustment to the spider deflection, as shown in the second iteration, was all that was additionally needed to obtain the target speaker $f_o$.

The next step is to manipulate $Q_{ts}$ so that it matches the target value. Since $Q_{ts}$ is greatly affected by the $Q_{es}$, which in turn is strongly related to Bl, I made changes in the magnet thickness.

As you can see, the target $Q_{ts}$ is achieved with a new magnet thickness of 40mm, which is twice the starting size, although the motor strength is somewhat high. This also seems like an expensive option, so by experimenting with the magnet OD, it was easy to determine that changing the magnet from 120mm to 130mm produced good results.

After looking at a magnet supplier's catalog, I inserted 130mm-OD and 65mm-ID magnet dimensions to reduce the total magnetic area and bring the parameters close to the desired target. You can see how each of these iterations affected the box performance in *Fig. 0.32*, which is a LEAP box simulation series that uses the starting T/S parameter set given in this exercise plus each of the four iteration T/S parameters sets.

### 0.74 WOOFER DESIGN FOR A COMPACT SEALED ENCLOSURE.

After all of this work, the marketing department for the small car audio company finally woke up and smelled the coffee to realize that most of its competitors were selling car audio subwoofers that performed reasonably in small enclosures of 1.25-0.75$ft^3$. Two new performance parameters were added to the mix—a 0.75$ft^3$ box with an $f_b$ of 50Hz. Given the low-frequency response "lift" supplied by the average car compartment, 50Hz is more than adequate (see *Chapter 11, Section 11.4 Computer Simulation of Closed-Field Performance*).

These box criteria are typical of current car subwoofers on the market and describe many of the 12" car subs I have reviewed for *Car Audio and Electronics* magazine over the past two years. The Reverse Synthesis program determined a target parameter set (*Fig. 0.33*) which I then entered into the main menu system of SpeaD. You can follow the various changes made through four separate iterations done for the driver in *Table 0.5*.

Just as with all of the other designs, the process begins by getting the $f_o$ to match the target parameter. $f_o$ on this speaker was similar to the first design and required only a change to the spider deflection to hit the free-air resonance target.

**FIGURE 0.33: Parameters for compact design using Reverse SpeaD.**

#### TABLE 0.4: BANDPASS ENCLOSURE DESIGN

| Target Parameters | Starting Data | 1st Iteration | 2nd Iteration | 3rd Iteration | 4th Iteration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| $R_{EVC}$ | 3.5 | 3.5 | 3.5 | 3.5 | 3.5 | 3.5 |
| $f_o$ | 28.68 | 33.77 | 29.62 | 28.79 | 28.79 | 28.79 |
| $Q_{ts}$ | 0.5160 | 0.7404 | 0.6553 | 0.6381 | 0.5161 | 0.5366 |
| $Q_{es}$ | 0.5440 | 0.7996 | 0.7013 | 0.6816 | 0.5442 | 0.567 |
| $Q_{ms}$ | 10 | 10 | 10 | 10 | 10 | 10 |
| $V_{AS}$ | 70.82 | 51.47 | 66.91 | 70.83 | 70.83 | 70.83 |
| Bl | 13.05 | 11.64 | 11.64 | 11.64 | 13.03 | 12.77 |
| $X_{MAX}$ | 8.00 | 7.38 | 7.38 | 7.38 | 7.38 | 7.38 |
| $M_{md}$ | 140.00 | 139.86 | 139.86 | 139.86 | 139.86 | 139.86 |
| SPL 2.83V | 90.36 | 89.46 | 89.46 | 89.46 | 90.43 | 90.26 |
| Vb1 S | 0.79 | | | | | |
| Vb2 V | 1.20 | | | | | |

**Key Parts**
*   Cone $f_o$: 41 (Start), 35 (1st), 35 (2nd), 35 (3rd), 35 (4th)
*   Spider deflection: 0.5mm @ 50g (Start), 0.5mm @ 50g (1st), 0.7mm @ 50g (2nd), 0.7mm @ 50g (3rd), 0.7mm @ 50g (4th)
*   Magnet OD: 120 (Start), 120 (1st), 120 (2nd), 120 (3rd), 130 (4th)
*   Magnet TH: 20 (Start), 20 (1st), 20 (2nd), 40 (3rd), 20 (4th)
*   Magnet ID: 60 (Start), 60 (1st), 60 (2nd), 60 (3rd), 65 (4th)
*   FP & BP OD: 110 (Start), 110 (1st), 110 (2nd), 110 (3rd), 120 (4th)
*   Note: 3rd Iteration uses 60 oz magnet, 4th Iteration uses 35 oz magnet.

---

![Page 18](images/page_29.png)

eter. $f_o$ on this speaker was similar to the first design and required only a change to the spider deflection to hit the free-air resonance target.

The second change was again to increase the magnet and plate ODs. This time changing the OD produced a little more magnet energy than needed, so in the last iteration the frontplate ID was modified to fine-tune the Bl and thereby adjust the $Q_{ts}$.

Using the Design Overview feature in Reverse SpeaD allows you to compare the four different response curves generated for this exercise (*Fig. 0.34*). It is interesting to note that the first three designs all have the same basic targets for box size but very different responses. The first sealed system has the lowest efficiency, while the vented system is slightly more efficient and includes more low-frequency extension. The bandpass system is very efficient, but has a somewhat narrow bandwidth.

For use as a car audio subwoofer, the small sealed box is probably the best choice out of the four. It is efficient, with good power handling, and a reasonably small magnet structure to keep its cost down.

### 0.75 EXTENDED POLE DYNAMICS.

*Section 0.20, The Motor System*, discussed some of the basics of different pole shapes and their effects upon the magnetic linearity of a driver motor. For the specific case of extended pole configurations, SpeaD offers some unique opportunities to play "what if" with different degrees of pole extension.

One of the most important aspects of this software is the way that the magnet modeling system tracks the strength of the magnetic flux in the gap (Bg), and, more important, the shape of the magnetic field that determines the amount of energy applied to the coil. An interesting way to apply this program feature is to compare what happens to the driver's

**FIGURE 0.34: Comparing design responses.**
**FIGURE 0.35: Pole extension comparison.**

#### TABLE 0.5: COMPACT SEALED BOX DESIGN

| Target Parameters | Starting Data | 1st Iteration | 2nd Iteration | 3rd Iteration |
| :--- | :--- | :--- | :--- | :--- |
| $R_{EVC}$ | 3.5 | 3.5 | 3.5 | 3.5 | 3.5 |
| $f_o$ | 39.64 | 33.77 | 39.21 | 39.21 | 39.21 |
| $Q_{ts}$ | 0.6957 | 0.7404 | 0.8495 | 0.6461 | 0.6820 |
| $Q_{es}$ | 0.7477 | 0.7996 | 0.9283 | 0.6907 | 0.7368 |
| $Q_{ms}$ | 10 | 10 | 10 | 10 | 10 |
| $V_{AS}$ | 35.71 | 51.47 | 38.18 | 38.18 | 38.18 |
| Bl | 13.32 | 11.64 | 11.64 | 13.50 | 13.07 |
| $X_{MAX}$ | 8.00 | 7.38 | 7.38 | 7.38 | 7.38 |
| $M_{md}$ | 140 | 139.86 | 139.86 | 139.86 | 139.86 |
| SPL 2.83V | 90.61 | 89.46 | 89.46 | 90.74 | 90.46 |

**Key Parts**
*   Spider deflection: 0.5mm @ 50g (Start), 0.15mm @ 50g (1st), 0.15mm @ 50g (2nd), 0.15mm @ 50g (3rd)
*   Magnet OD: 120 (Start), 120 (1st), 130 (2nd), 130 (3rd)
*   FP & BP OD: 110 (Start), 110 (1st), 120 (2nd), 120 (3rd)
*   Frontplate ID: 54.25 (Start), 54.25 (1st), 54.25 (2nd), 54.75 (3rd)

#### TABLE 0.6: POLEPIECE EXTENSION DYNAMICS

| Pole Extension mm | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Bg (T) | 0.61 | 0.60 | 0.59 | 0.58 | 0.57 | 0.56 | 0.56 | 0.56 | 0.55 |
| Bl (TM) | 10.90 | 11.02 | 11.16 | 11.30 | 11.47 | 11.64 | 11.60 | 11.51 | 11.42 |
| $Q_{ts}$ | 0.958 | 0.939 | 0.919 | 0.897 | 0.874 | 0.850 | 0.856 | 0.868 | 0.881 |
| $Q_{es}$ | 1.060 | 1.036 | 1.012 | 0.985 | 0.958 | 0.928 | 0.936 | 0.951 | 0.966 |
| $X_{MAX}$ (mm) | 9.58 | 9.77 | 9.98 | 10.23 | 10.50 | 10.82 | 10.82 | 10.82 | 10.82 |
| SPL @ 2.83V | 88.88 | 88.98 | 89.08 | 89.2 | 89.32 | 89.46 | 89.42 | 89.35 | 89.29 |
