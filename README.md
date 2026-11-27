# Black Bubble

Black Bubble reads replies aloud in the ChatGPT conversation you already use. You can speak your next question when the bubble says **Listening**. It works in an open browser tab. You use your usual ChatGPT account and choose the voice that reads the answer.

Black Bubble is an independent project. It isn’t made, approved or supported by OpenAI, ElevenLabs or Fish Audio.

## What happens when you press Talk

1. Open your chat and keep the tab in the foreground. Choose a reply voice using the waveform button. Press **Talk hands-free** and allow the microphone and speech recognition if your browser asks.
2. When you see **Listening**, speak. When you have been quiet for about two and a half seconds, Black Bubble puts the words in the message box and presses ChatGPT’s Send button for you. There is no separate send confirmation. If a call stops in the middle of your turn, the words it heard are left in the message box, unsent.
3. It watches for the completed reply to that question. With **ChatGPT’s own voice**, it uses the page’s **Read aloud** control. What you hear depends on the voice ChatGPT makes available. With **Device voice**, an installed voice reads the reply. There are also two paid options, described below.
4. After playback, the microphone opens for your next question. Press the square stop button to end the call. If it pauses, the words under **Paused** tell you why.

## Chrome 0.3.16

This desktop browser extension has been used in signed-in ChatGPT conversations in Chrome on one Windows computer, with a real microphone and speakers: long back-and-forth conversations on this build, and one spoken turn of about 400 words on the build before it. ChatGPT’s own voice, a device voice and ElevenLabs have each been heard working on this build. Fish Audio has not been tested by us yet. Nothing has been tried on other computers or other Chrome-family browsers yet.

To install, click the green **Code** button on this page and choose **Download ZIP**. Unzip it and keep the `chrome` folder somewhere permanent. Type `chrome://extensions` into Chrome’s address bar and press Enter. Turn on **Developer mode** at the top right and leave it on. Click **Load unpacked** and choose the `chrome` folder, the one containing `manifest.json`. Refresh the ChatGPT tab. If you reload the extension later, refresh the tab again. If you turn Developer mode off, Chrome may switch the extension off.

If the bubble says **Paused** before you have spoken, look in the message box at the bottom of the chat. Send or clear any draft or attachment, then start again.

iPhone and Android versions are in private testing and are not released.

## Permissions and where your words go

| Permission or destination | What it does |
| --- | --- |
| Access to `https://chatgpt.com/*` | Chrome needs access to your chat page to see the message box, match your question to the new reply, and use Send and Read aloud. ChatGPT handles the question and any page audio through your existing session. Black Bubble never asks for your ChatGPT password, session token or OpenAI API key. |
| Microphone and speech recognition | The browser turns speech into text. The browser maker controls where dictation is processed and which service it contacts. Black Bubble cannot promise that your voice stays on the device. In Chrome, dictation can mean your voice is sent to Google’s speech service. |
| Local storage | Chrome’s `storage` permission keeps your chosen voice and any provider credentials in this browser profile. The page also remembers preferences such as call size. |
| `https://api.elevenlabs.io/*` | If you choose ElevenLabs, the extension sends the reply text to `https://api.elevenlabs.io/v1/text-to-speech/{voice-id}?output_format=mp3_44100_128` using your ElevenLabs key. The service returns audio and uses your account credits. |
| `https://api.fish.audio/*` | If you choose Fish Audio, the extension sends the reply text and your chosen voice ID to `https://api.fish.audio/v1/tts` using your Fish Audio key. The service returns audio and uses your account credits. We have not tested Fish Audio ourselves yet. |
| Terms link | Opening the terms link takes you to `https://openai.com/policies/terms-of-use/`. It opens only when you choose the link. |

Chrome requests both provider site permissions at installation. Only the provider you choose receives the reply being read and its own key. The settings page reads the voice ID from a pasted share link locally. **Forget key** removes a saved key from this profile. The device voice needs no provider.

Black Bubble has no server, telemetry or voice-cloning feature. It does not save recordings or a separate copy of your conversations. Your dictated messages still become part of your ChatGPT chat. The fonts are bundled and load from the installed files.

## OpenAI’s terms

OpenAI’s terms prohibit “Automatically or programmatically extract data or Output (defined below).” This reader automatically finds the newest completed reply and reads it aloud for accessibility. OpenAI has not approved it. You decide whether to use it with your account. If OpenAI asks us to take it down, we will do so that day. [OpenAI Terms of Use, read November 25, 2026](https://openai.com/policies/terms-of-use/)

## Read the code or report a problem

- For Chrome, start with the [permissions](chrome/manifest.json), the [code that reads and sends on the page](chrome/bubble.js), and the [two provider requests](chrome/background.js).
- To report a problem, email **hello@sinandsarah.com** with the build number, the browser you used and the words shown under **Paused**. Please leave out chat text and provider keys.

The project code carries the [MIT licence](LICENSE). The bundled font has its own [licence notice](THIRD_PARTY.md).
