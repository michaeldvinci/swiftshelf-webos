# SwiftShelf for webOS

A native webOS TV client for [Audiobookshelf](https://www.audiobookshelf.org/) - listen to your audiobook library on LG smart TVs.

<img src="_res/carousel.png" width="700">

## Features

- Browse your Audiobookshelf libraries
- Continue listening from where you left off
- Full playback controls with chapter navigation
- Progress sync with your Audiobookshelf server
- Search across your library
- TV-optimized remote control navigation
- Customizable playback speed
- Support for multiple libraries

## Screenshots

| Library View | Sidebar Navigation |
|:---:|:---:|
| <img src="_res/carousel.png" width="500" height="300"> | <img src="_res/sidebar.png" width="500" height="300"> |

| Audiobook Details | Audio Player |
|:---:|:---:|
| <img src="_res/item-info.png" width="500" height="300"> | <img src="_res/player.png" width="500" height="300"> |

| Settings |
|:---:|
| <img src="_res/settings.png" width="500" height="300"> |

## Installation

### Prerequisites

- LG webOS TV (webOS 3.0+)
- [Audiobookshelf](https://www.audiobookshelf.org/) server
- [webOS TV SDK](https://webostv.developer.lge.com/develop/tools/sdk-introduction) (for development/sideloading)

### Install via Homebrew Channel

Coming soon.

### Manual Installation (Sideloading)

1. Enable Developer Mode on your LG TV
2. Install the webOS TV SDK on your computer
3. Connect to your TV using `ares-setup-device`
4. Install the IPK:
   ```bash
   ares-install com.swiftshelf.webos_1.0.0_all.ipk
   ```

## Configuration

SwiftShelf supports two authentication methods:

### Username & Password
Enter your Audiobookshelf server URL, username, and password directly in the app.

### API Key
1. Log into your Audiobookshelf server web interface
2. Go to Settings > Users > Your User > API Token
3. Copy the API key
4. Enter your server URL and API key in the app

## Development

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/michaeldvinci/swiftshelf-webos.git
   cd swiftshelf-webos
   ```

2. Copy the example config (for local testing):
   ```bash
   cp .swiftshelf-config.example.json .swiftshelf-config.json
   ```

3. Edit `.swiftshelf-config.json` with your server details.

### Building

Package the app:
```bash
ares-package .
```

### Running on TV

1. Set up your device:
   ```bash
   ares-setup-device
   ```

2. Install and launch:
   ```bash
   ares-install com.swiftshelf.webos_1.0.0_all.ipk
   ares-launch com.swiftshelf.webos
   ```

### Running in Browser (Development)

For quick testing, you can run a local server:
```bash
ares-server .
```
Then open `http://localhost:3000` in your browser.

## Remote Control

| Button | Action |
|--------|--------|
| **Arrow Keys** | Navigate |
| **OK/Enter** | Select |
| **Back** | Go back / Close modal |
| **Play/Pause** | Toggle playback |

### Player Controls

| Button | Action |
|--------|--------|
| **Left/Right** | Seek -/+ 30 seconds |
| **Up/Down** | Previous/Next chapter |

## Project Structure

```
swiftshelf-webos/
├── index.html          # Main HTML
├── appinfo.json        # webOS app manifest
├── css/
│   └── styles.css      # Styles
├── js/
│   ├── api.js          # Audiobookshelf API client
│   ├── storage.js      # Local storage handling
│   ├── navigation.js   # TV remote navigation
│   └── app.js          # Main application logic
├── icon.png            # App icon (80x80)
└── largeIcon.png       # Large app icon (130x130)
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Audiobookshelf](https://www.audiobookshelf.org/) - The amazing self-hosted audiobook server
- [webOS TV Developer](https://webostv.developer.lge.com/) - LG's developer resources
