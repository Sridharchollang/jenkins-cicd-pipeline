# IRCTC Passenger Autofill

A separate Microsoft Edge Manifest V3 extension for the IRCTC passenger-information page.

## Supported fields

- Full Name as per Govt. ID
- Age
- Gender
- Country
- Preference
- New Passenger modal opening
- Existing Passenger list opening and name matching where the page exposes passenger names in the DOM

## Install

1. Open `edge://extensions` and enable Developer mode.
2. Choose **Load unpacked**.
3. Select the repository's `irctc-autofill` folder containing `manifest.json`.
4. Open or reload the IRCTC passenger page.
5. Open the extension, create a profile, and choose **Fill New Passenger** or **Select Existing Passenger**.

The extension is intentionally limited to passenger form assistance. It does not automate CAPTCHA, payment, quota selection, queue handling, or final booking submission. Always review every field and use the official IRCTC controls yourself.
