# Loudspeaker Design Cookbook - Part 6

## Page 22

![Page 22](images/page_33.png)

are adjusted from 20% to a lower 10% level of distortion.

For woofers and subwoofers, Le (X) isn't really relevant and primarily refers more to hearable intermodulation distortion in midrange-type speakers. *Table 0.9* gives displacement limiting Bl and compliance numbers for the five samples. For woofer sample #1, even though Xmax is only 2mm physically, this woofer can give satisfactory performance out to 5mm of travel before Bl derived distortion became slowly audible.

### TABLE 0.9

| Sample# | Bl (X) | Cms (X) |
| :--- | :--- | :--- |
| 1 | 5mm | 7.3mm |
| 2 | 10mm | 8.4mm |
| 3 | 15.2mm | 11.3mm |
| 4 | 15.2mm | 10.8mm |
| 5 | 16.5mm | 10.4mm |

Woofer sample #2 has as its primary change an increase in voice coil length from 14mm to 24mm giving the driver an Xmax of 7mm, up from 2mm for woofer sample #1. Looking at the Bl (X) curve in *Fig. 0.45*, it's immediately obvious what the effect of additional voice coil length has on the excursion capability of the woofer. The Bl curve for this woofer has more of a broad plateau shape and only gradually decreases Bl with increasing travel in either direction. As with woofer sample #1, you still see a moderate forward offset in the Bl (X) curve, with not much in the way of change in the Kms (X) or Le (X) curves, as would be expected. Displacement limiting numbers likewise increased, but now are somewhat less than the physical Xmax for this driver.

Woofer sample #3 also has a substantial increase in the voice coil length, again accompanied by an increase in motor size. Xmax for sample #3 is now 15mm, more than double the Xmax of woofer sample #2. The Bl (X) curve in *Fig. 0.48* is now more

---

**FIGURE 0.42: Klippel Bl (X) curve for woofer sample #1.** (Graph shows a peak at approx 10.5 N/A, centered around -1.0mm)
**FIGURE 0.43: Klippel Kms (X) curve for woofer sample #1.** (Graph shows a parabolic shape with a minimum at approx 4.0 N/mm)
**FIGURE 0.44: Klippel Le (X) curve for woofer sample #1.** (Graph shows a descending curve from approx 2.2 mH to 0.8 mH)
**FIGURE 0.45: Klippel Bl (X) curve for woofer sample #2.** (Graph shows a broader peak at approx 8.5 N/A)
**FIGURE 0.46: Klippel Kms (X) curve for woofer sample #2.** (Graph shows a parabolic shape with a minimum at approx 3.0 N/mm)
**FIGURE 0.47: Klippel Le (X) curve for woofer sample #2.** (Graph shows a descending curve from approx 2.2 mH to 0.8 mH)

## Page 23

![Page 23](images/page_34.png)

defined and has a wider, less shallow, plateau, but also has a definite asymmetrical tilt and a substantial rearward offset of 7mm at rest due mostly to the gap field asymmetry and the longer voice coil. Again, with no changes in the suspension, the Kms (X) curve is similar to woofer sample #2.

The only change made in woofer sample #4 was to trade the asymmetrical cupped spider for a more linear flat spider. The Bl (X) curve for sample #4 shows little change, but the Kms (X) curve is now more symmetrical and has less forward offset than was present with the first three woofer samples that featured the cupped-type spider.

The easiest way to make the fringe field in the forward direction more like the rear fringe field is to extend the pole (see *Section 0.75 and Figs. 0.36-0.37*). This was the only change made to sample #5, and the effect is very pronounced. Looking at the Bl (X) curve in *Fig. 0.54*, the Bl plateau is now very symmetrical with practically no offset whatsoever.

Because the Klippel analyzer will also output distortion curves for the individual distortion components caused by Bl, compliance, or inductance, Bl distortion curves were generated to compare performance with and without the pole extension. *Figures 0.57 and 0.58* depict the distortion component of the Bl function for woofer sample #4 and woofer sample #5, respectively, where the only difference is

---

**FIGURE 0.48: Klippel Bl (X) curve for woofer sample #3.** (Graph shows a broad plateau at approx 11.5 N/A with a rearward offset)
**FIGURE 0.49: Klippel Kms (X) curve for woofer sample #3.** (Graph shows a parabolic shape with a minimum at approx 2.5 N/mm)
**FIGURE 0.50: Klippel Le (X) curve for woofer sample #3.** (Graph shows a descending curve from approx 4.5 mH to 2.0 mH)
**FIGURE 0.51: Klippel Bl (X) curve for woofer sample #4.** (Graph similar to 0.48)
**FIGURE 0.52: Klippel Kms (X) curve for woofer sample #4.** (Graph shows a more symmetrical parabolic shape)
**FIGURE 0.53: Klippel Le (X) curve for woofer sample #4.** (Graph similar to 0.50)
**FIGURE 0.54: Klippel Bl (X) curve for woofer sample #5.** (Graph shows a very symmetrical plateau at approx 11.5 N/A)

## Page 24

![Page 24](images/page_35.png)

the 5mm pole extension. Combine this with the reasonably symmetrical compliance in woofer sample #5, and you now have a substantially more linear driver with significantly greater excursion and lower distortion at high output levels compared with the first woofer sample #1.

### 0.82 SHORTING RINGS AND DISTORTION

Section 0.22 discusses the benefits of adding a shorting ring to a woofer or midrange to reduce the AC eddy currents generated by voice coil motion, a parasitic current flow that is responsible for flux modulation of the magnetic field and sometimes a substantial amount of inductive heating in large motor woofers and subwoofers. The change in inductance using a shorting ring is immediately obvious when you examine the Klippel Le (X) curves for woofer sample #6 and woofer sample #10, essentially the same driver but with sample #10 having a large aluminum shorting ring similar to Type D in *Fig. 0.6*.

If you compare the MLSSA derived T/S parameters in *Table 0.10*, you see virtually no difference due to the shorting ring. However, the difference in voice coil inductance can easily be observed in Le (X) curves shown in *Fig. 0.59* for woofer sample #6 and *Fig. 0.60* for woofer sample #10. Not only has inductance decreased in the rearward direction with the introduction of a large aluminum shorting ring, but it has also resulted in an overall decrease in total motor inductance.

### TABLE 0.10

| | Sample #6 | Sample #10 |
| :--- | :--- | :--- |
| $R_e$ | 3.08 | 3.06 |
| $F_s$ | 24.86 | 24.67 |
| $Q_{ms}$ | 6.81 | 6.23 |
| $Q_{es}$ | 0.50 | 0.50 |
| $Q_{ts}$ | 0.46 | 0.47 |
| $V_{as}$ | 40.82 liters | 40.43 liters |
| $M_{md}$ | 158.85 | 158.85 |
| $Bl$ | 12.52 | 12.36 |

---

**FIGURE 0.55: Klippel Kms (X) curve for woofer sample #5.**
**FIGURE 0.56: Klippel Le (X) curve for woofer sample #5.**
**FIGURE 0.57: Klippel Bl product distortion curve for woofer sample #4 (no pole extension).** (Note: Text says #5 with 5mm pole extension in caption but text context implies comparison)
**FIGURE 0.58: Klippel Bl product distortion curve for woofer sample #5 (with 5mm pole extension).**
**FIGURE 0.59: Klippel Le (X) curve for woofer sample #6 (no shorting ring).**
**FIGURE 0.60: Klippel Le (X) curve for woofer sample #10 (with shorting ring).**
