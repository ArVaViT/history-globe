# Errors found in Theographic, OpenBible, Pleiades and Wikidata

Checked 2026-10-17. Sources, all downloaded the same night:

- Theographic Bible Metadata, `json/places.json` and `json/verses.json` from GitHub `robertrouse/theographic-bible-metadata`, branch master (CC BY-SA 4.0). Only their record ids and a few quoted field values appear here.
- OpenBible ancient records: `pipeline/.cache/openbible-ancient.jsonl` (fetched by `pnpm data`). Page URL pattern checked live: `https://www.openbible.info/geo/ancient/<id>` (HTTP 200).
- Pleiades: `pleiades-places-latest.csv.gz` dump, plus live `pleiades.stoa.org/places/<id>/json` for the ids named below.
- Wikidata: `wbgetentities` for all 647 QIDs used by us or by OpenBible, plus live re-checks for the items named below. English Wikipedia API (`prop=coordinates|extracts`) used where noted.
- Verse text: KJV, from the eBible KJV in `pipeline/.cache`.

Distances are haversine (great-circle) distances. Severity: **high** means the record points at the wrong place or the wrong country; **medium** means it misleads a map or a join; **low** is cosmetic or a completeness gap.
"Confirmed" means I opened the record and the evidence myself. Anything less certain is in "To check".

---

## Theographic: confirmed

### T1. Salmone (Acts 27:7) is placed at the Salmone in Elis, in the Peloponnese, not at the Cretan cape. Severity: high

- Record: `rec87ltw24GIvuFnT` (`salmone_1020`), `latitude` 37.69636, `longitude` 21.56999, `featureType` "City".
- Evidence: Acts 27:7 reads "...we sailed under Crete, over against Salmone." Their coordinate is exactly Pleiades 570652 "Salmone" (BAtlas 58 B2), a place in Elis (0.0 km). Their own `openBibleLat/openBibleLong` (35.2123, 26.2745, Cape Sideros on Crete) is 503 km away. OpenBible and we put it on Crete.
- What went wrong: the homonym was picked up in place of the cape.

### T2. Kidron (the brook at Jerusalem) has the coordinates of Gedros/Kedron near Yavne. Severity: high

- Record: `reccf5Vf48NjEXaxz` (`kidron_687`), lat 31.826142, lon 34.775865. Its verses include 2Sam.15.23, 1Kgs.15.13, 2Kgs.23.4, 2Kgs.23.6, 2Kgs.23.12, 2Chr.29.16 and Jer.31.40.
- Evidence: 2Sam.15.23 has David leaving Jerusalem: "the king also himself passed over the brook Kidron... toward the way of the wilderness." Their coordinate matches Pleiades 687905 "Gedros" (0.0 km), the coastal-plain Kedron of 1 Maccabees. It lies 44 km west of their own alias record `brook_kidron_688` (31.772134, 35.236596), which sits correctly at Jerusalem, and 44 km from the record's own `openBibleLat/Long`.

### T3. Gilgal (Joshua's camp "in the east border of Jericho") is placed in the Sharon plain. Severity: high

- Record: `recdm9AlLF01lFAfP` (`gilgal_476`), lat 32.1547, lon 34.95372. It carries 35 verses, including Josh.4.19, Josh.4.20, Josh.5.9 and Josh.5.10.
- Evidence: Josh.4.19 reads "...encamped in Gilgal, in the east border of Jericho." The coordinate is 56 km from their own Jericho (`jericho_634`, 31.870, 35.444). It sits 3 to 4 km from Pleiades 678223 Kapharsaba, near the Jaljulia that some identify with the Gilgal of Josh 12:23. Their `openBibleLat/Long` (31.8638, 35.5185) is correctly by Jericho.

### T4. Rimmon of the Negeb (Josh 15:32 and parallels) is placed in northern Lebanon. Severity: high

- Record: `recZuw7dAJ1x1EUfb` (`rimmon_1004`), lat 34.353071, lon 36.385705. Verses: Josh.15.32, Josh.19.7, 1Chr.4.32 and Zech.14.10.
- Evidence: Josh.15.21 introduces the list as "the uttermost cities of the tribe of the children of Judah toward the coast of Edom southward". Josh.15.32 then ends "...and Ain, and Rimmon." The coordinate is 4.5 km from Pleiades 668264 Hermel in the Lebanese Beqaa, and 375 km from their own Beersheba (`rectrAkGtrZH5LMp8`). The same value appears in their `openBibleLat/Long`, so it was probably inherited from the 2007 OpenBible data. Today's OpenBible puts Rimmon in the Negeb (31.383, 34.866).

### T5. Jezreel of Judah (Josh 15:56) is placed on Beth-shean. Severity: high

- Record: `recdU0shMzVelyTiU` (`jezreel_642`), lat 32.502074, lon 35.50196. Verses include Josh.15.56, 1Sam.25.43 and 2Sam.3.2.
- Evidence: Josh.15.56 ("And Jezreel, and Jokdeam, and Zanoah") belongs to the hill-country list of Judah (Josh 15:48 and following). The coordinate is 0.2 km from Pleiades 678378 Scythopolis/Nysa (Beth-shean) and 0.26 km from their own `beth-shan_232`. Their own `openBibleLat/Long` for this record (31.5358, 35.0941, south of Hebron) is 114 km away.

### T6. Jezreel in the north (Naboth's city) is also placed on Beth-shean. Severity: medium

- Record: `reczRCunsz83wZ1Q1` (`jezreel_643`, 22 verses, including 1Kgs.21.1 and 2Kgs.9.30), lat 32.502074, lon 35.50196. This is the same value as T5.
- Evidence: the record's own `openBibleLat/Long` (32.55596, 35.33079, Tel Jezreel) is 17 km away. The coordinate is 0.26 km from their Beth-shan.

### T7. Verses about the northern Jezreel are tagged to the Judahite Jezreel. Severity: medium

- Verses 1Sam.29.1 and 1Sam.29.11 are attached to `jezreel_642` (Judah) in both `places.verses` and `verses.places`.
- Evidence: 1Sam.29.1 reads "the Israelites pitched by a fountain which is in Jezreel". The setting is the Gilboa campaign: 1Sam.28.4 says "...the Philistines... pitched in Shunem: and Saul... pitched in Gilboa." That is the northern Jezreel, which they keep as `jezreel_643`.

### T8. Duplicate record for the northern Jezreel. Severity: low

- `recbCUdlemxNGIKfQ` (`jezreel_644`) holds only 2Sam.4.4 ("...when the tidings came of Saul and Jonathan out of Jezreel"). It is the same city as `jezreel_643`, with identical OpenBible coordinates to 8 decimals. The two records are not linked through `canonicalPlace`/`otherNames`, unlike their other alias pairs (Olivet/Mount of Olives, Elteke/Eltekeh).

### T9. Duplicate record: valley of Shaveh. Severity: low

- `recruGIaExz1GoMbG` (`valley_of_shaveh_692`: Gen.14.17, 2Sam.18.18) and `recZeNEbOWIqV0AmA` (`valley_of_shaveh_1216`: Gen.14.17). The same verse ("the valley of Shaveh, which is the king's dale") and the same coordinates appear in two unlinked records.

### T10. Place names in the KJV text with no place tag. Severity: medium

I checked every KJV verse whose `verseText` contains the name as a whole word. These verses have **no** link to that place in `verses.places`, and none appears in the place's `verses` list either:

- **Jerusalem** (`recL1WV82pXaRBQ59`), 13 of 767 verses: 2Chr.30.26, 2Chr.31.4, 2Chr.32.2, 2Chr.32.9, 2Chr.32.10, 2Chr.32.12, 2Chr.32.18, Jer.7.29, Jer.8.5, Luke.2.42, Luke.24.49, Acts.4.6 and Acts.18.21. The clearest case is 2Chr.32.9: it is tagged with Lachish and Assyria, while "Jerusalem" appears twice in the verse untagged. Luke.24.49 reads "tarry ye in the city of Jerusalem".
- **Asia** (`recpCMN0bRpzByjaR`): Acts.19.31, Acts.20.4 and Rev.1.11. Rev.1.11 is tagged with the seven cities but not with "the seven churches which are in Asia". Acts.20.4 carries only Derbe; Berea and Asia are missing.
- **Macedonia** (`recly2TmP9CBHh8OQ`): Acts.19.29 ("men of Macedonia") and 2Cor.9.4.
- **Galilee** (`recmL1lWBqWP3mAq3`): Matt.26.69 ("Jesus of Galilee"), Luke.23.6 ("When Pilate heard of Galilee") and Acts.5.37 ("Judas of Galilee").
- **Nazareth** (`recmRfnw4XzPBH9jc`): Mark.14.67 ("Jesus of Nazareth").
  (Matt.4.18 and similar "sea of Galilee" verses are tagged to the Sea of Galilee, which is correct and not counted. Hebron hits that refer to the person Hebron are not counted either.)

### T11. Records with a latitude and no longitude. Severity: low

`recAPCFiiSX6hmHhX` (azotus_132), `recU8S3zWJLQkEpwO` (chios_296), `recFrC0435yiaHYOu` (clauda_280), `recb5itcp169E9Vsj` (lasea_717) and `reco41jQa2HDPSWx2` (phrygia_946) have `latitude` set and `longitude` missing. Each still has `openBibleLong`. Anything that reads `latitude/longitude` drops these five places.

### T12. The Edom point sits next to Beersheba, west of the Arabah. Severity: medium

- `recLcxRZbz3yIQB7b` (edom_357): lat 31.25, lon 34.75, 8.6 km from their own Beersheba. Edom lies east of the Arabah (Num.20.16: "Kadesh, a city in the uttermost of thy border"). Their own `openBibleLat/Long` (30.7347, 35.6063) and their Bozrah are about 100 km away. A region point may be rough, but this one falls in another territory, Judah's Negeb.

### T13. The Bithynia point is in the Black Sea. Severity: low

- `rec5XS12X23Uadj5G` (bithynia_250): 42.5, 32.5. That is 84 km north of Amasra (41.746, 32.386), the nearest coast, so the point is open sea. Their `openBibleLat/Long` is 40.9055, 30.6858, on land.

## Theographic: to check

- **Jotbah** (`recgcRR8lIX8T7Tr7`, 2Kgs.21.19) is at 29.758, 35.031, which is the Jotbathah/Taba area near Eilat. OpenBible and we put it at Yodfat in Galilee, 343 km away. The Galilee identification is the majority view, but older literature did equate Jotbah with Jotbathah. Not an outright error.

---

## OpenBible: confirmed

### O1. Cnidus (Acts 27:7) links to the Pleiades Knidos on Cyprus. Severity: high

- Record: https://www.openbible.info/geo/ancient/ab793ce, `linked_data.s2428ed.id` = `707539`.
- Evidence: Pleiades 707539 "Knidos" is described as "an ancient city of Cyprus located on the Elaea promontory in northeastern Cyprus" (35.329, 34.055). That is 619 km from OpenBible's own Cnidus coordinate (36.686, 27.375, Tekir in Caria). The Carian city is Pleiades 599575 "Cnidus (Tekir)".

### O2. Madmenah (Isa 10:31) links to the Wikidata item for Madmannah (Josh 15:31). Severity: medium

- Record: https://www.openbible.info/geo/ancient/a67297a, `s7cc8b2` = `Q6728293`. That item's label is "Madmannah", its enwiki page is "Menois", and its P1584 is 687964 "Maon/Menoeis".
- Evidence: Isa.10.31 ("Madmenah is removed; the inhabitants of Gebim gather themselves to flee") falls in the Assyrian approach list north of Jerusalem, next to Anathoth and Nob. Josh.15.31 ("And Ziklag, and Madmannah, and Sansannah") is in the Negeb. The Pleiades place linked through that QID is 95 km from OpenBible's own Madmenah point (31.820, 35.223).

### O3. Wikidata links that point to disambiguation pages. Severity: medium

Each item below has P31 = Q4167410 ("Wikimedia disambiguation page"), checked live:

- `ad4ad26` Alemeth → Q4716077
- `ad68510` Eshtemoa → Q5397937
- `a9ef72b` Peor → Q61862532
- `ad27541` Ramah (Ramah 5, 2Kgs.8.29) → Q412380
- `af0ac29` Elath → Q3721153, which now redirects to Q1303899, the "Eilat (disambiguation)" page

### O4. Wikidata links that are now redirects. Severity: low

These QIDs resolve, but only through a redirect, so joins on the raw id miss them. Old → current:
Achzib `a2270e4` Q54991090→Q1323297; Allammelech `a84cafa` Q28220401→Q6573228; Azal `ad041dd` Q4832126→Q7217851; Beth-anath `ae6cef8` Q60790206→Q25492503; Daberath `a6a5e97` Q5207462→Q20502682; Elath `af0ac29` Q3721153→Q1303899; Ephraim `aa24ad4` Q27627879→Q18500022; Gabbatha `aec23b1` Q1488020→Q591994; Gadara `afed46a` Q96379011→Q56322109; Gibbethon `a6f048c` Q25493256→Q11298139; Kartah `ac0f6e7` Q6373489→Q117704182; Kir `ab92800` Q65086594→Q1742404; Pekod `a4b9865` Q48968605→Q11944059; Sychar `a27b472` Q12971071→Q1651088.

---

## Wikidata: confirmed

### W1. Antipatris (Q682612) has P1584 = "68799", which does not exist; the correct id is 687996. Severity: medium

- https://pleiades.stoa.org/places/68799/json returns HTTP 404, and 68799 is not in the Pleiades dump. https://pleiades.stoa.org/places/687996 is "Pegai/Antipatris/Arethousa?" at 32.1052, 34.9310, which matches the Wikidata P625 (32.105, 34.9304) to within 0.06 km. The value looks like 687996 with its last digit dropped.

### W2. Zoan (Q8073157) has P625 in Brazil. Severity: high

- P625 = −7.1215981, −34.882028, around João Pessoa, Brazil. The English Wikipedia article for the same item says Zoan "was a city of Egypt in the eastern Nile Delta" and equates it with Tanis. Tanis on Wikipedia is 30.977, 31.88. OpenBible, Pleiades 727236 (Tanis) and we all agree within 0.3 km. The error is 8,253 km.

### W3. Tegarama (Q12400954) P625 is 377 km from Gürün. Severity: high

- P625 = 39.801, 41.429, in Erzurum province. The English Wikipedia article for the item says Tegarama "is often identified with Gürün". Pleiades 628982 "Gauraina" (Gürün; alias Til-garimmu) is at 38.723, 37.257, and OpenBible's point is 2 km from it. Wikidata is 379 km from Pleiades.

### W4. Libnah (Q3486583) P625 is in Sinai, while the item's own Wikipedia article puts the city in the Shephelah. Severity: medium

- P625 = 29.9167, 34.6667, in the Sinai desert, which could only be the wilderness camp of Num 33:20. The enwiki article for this item has coordinates 31.63, 34.873, matching OpenBible's Libnah (31.6299, 34.8735). The distance is 192 km. The item is used for the city (Josh.10.29 etc.).

### W5. Aroer on the Arnon (Q4795478) P625 is at the mouth of the Arnon, 24 km from the site. Severity: low

- P625 = 31.4672, 35.5633 (the same value as enwiki), on the Dead Sea shore. Pleiades 697635 "Aroes" (31.4715, 35.8219) and OpenBible (31.4708, 35.8194, Khirbet 'Ara'ir) agree within 0.3 km. Deut 2:36 places Aroer "by the brink of the river of Arnon", and the tell is up on the gorge, not at the mouth.

### W6. Knidos (Q690575): P1584 points to the earlier site at Burgaz, while P625 is at Tekir. Severity: low

- P625 = 36.6858, 27.375 (Tekir). P1584 = 599576 "Cnidus (Burgaz)" at 36.7356, 27.6994, 29 km away. Pleiades 599575 "Cnidus (Tekir)" matches the item's coordinates, and Pleiades says the centre moved to Tekir in the later 4th century BCE. The coordinate and the Pleiades link describe two different sites. The item should carry 599575, possibly in addition to 599576.

## Wikidata: to check

- **Aenon (Q5977371)**: 31.8375, 35.5494, near Bethany beyond the Jordan. OpenBible and Pleiades 678003 put it near Salim, 61 km north. The location is genuinely disputed (the Madaba map supports the southern site), so this is not an error.
- **Thapsacus (Q1284954)**: 35.156, 40.428. OpenBible has 35.95, 38.17, 223 km away. Pleiades 674270 marks the place as "unlocated" with a rough point. The location is unknown.
- **Sharuhen (Q1548392)**: its preferred P625 is Tell el-Far'ah (South), which is one of three candidate identifications. It is 22 km from the OpenBible/Pleiades point. Disputed, not an error.

## Pleiades: confirmed

None. Every Pleiades id I looked up in depth resolved and matched its description.

## Pleiades: to check

- **674270 Thapsacus**: `locationPrecision` is "rough", the place is tagged "unlocated", and the representative point is 31.5, 44.5 in southern Iraq. Its own description says the city "lay on the western bank of the Euphrates" and that the site is unknown. Anyone who uses `reprLat/reprLong` blindly will put Thapsacus about 770 km from where most proposals place it.

---

## Where we (History Globe) disagree with them, or are wrong ourselves

1. **Cnidus `ab793ce`**: our `pleiades` = 599576 (Burgaz), which comes from Wikidata's P1584 (W6). Our own coordinate is at Tekir, and Acts 27 is 1st century CE, when the city was at Tekir. **Fixed 2026-10-17: content/pleiades.json now has 599575.**
2. **Madmenah `a67297a`**: our `wikidata` = Q6728293 is Madmannah (O2), inherited from OpenBible. **Fixed 2026-10-17: left out in scripts/wikidata-links.ts.**
3. **Five disambiguation QIDs** (O3: Alemeth, Elath, Eshtemoa, Peor, Ramah `ad27541`) and **14 redirected QIDs** (O4) appeared as-is in our `places.json`. **Fixed 2026-10-17: the five are left out, the fourteen followed to the current item (scripts/wikidata-links.ts).**
4. **Rhodes `a4218ee`** (kind settlement, Acts 21:1) and **Rhodes `a8c207b`** (island) both point to Pleiades 590031 "Rhodos (island)". For the settlement, 590030 "Rhodos (settlement)" fits our coordinate better: the island centroid is 36 km off. Not changed yet: the attested years of 590030 need the period table the original match used.
5. **Ramathaim-zophim `a54ef72`**: our `pleiades` = 688014 "Ramathaim/Arimathaia" (Rentis, via Wikidata Q1019146 P1584), but our coordinate (31.854, 35.232, Ramah/Nebi Samwil area) is 29 km away. The record contradicts itself. Either the coordinate or the link has to go. **2026-10-17: the Pleiades link is removed; which site is right is for the owner.**
6. **Tartessos `a86d7c7`**: Pleiades 256468 is "unlocated". Our point is 24 km from its representative point. Harmless, but it is a guess.
7. **Coordinates vs Theographic**: for 126 high-confidence matches, Theographic's point is more than 100 km from ours. Most of these are regions, rivers or seas with arbitrary centroids, or places OpenBible has re-identified since 2007. In at least two cases Theographic follows the mainstream identification as well as or better than old OpenBible data: **Lebo-hamath** (their point is Lebweh, 34.197, 36.342; ours is 0.7 km away, so we agree) and **Arpad** (Tell Rifaat; we agree). In the other cases I found, our coordinate is the better one (T1 to T6, T12, T13).
8. **Verse coverage**: we count verses from all translations, so we have places with no KJV verse at all (Aram-naharaim in the Ps 60 heading, Zaphon, Rhodes in Ezek 27:15, etc.). Theographic is KJV/ESV-based. Those differences are **not** Theographic errors and I did not list them.
9. **Not checked tonight**: contradictory OpenBible "same as" chains, TIPNR id correctness, and a full audit of Theographic verse tags for places outside the 16 names sampled in T10.
