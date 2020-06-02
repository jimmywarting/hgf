jQuery(function ($) {

    // initialize plyr
    var player = new Plyr('#audio1', {
        controls: [
            'restart',
            'play',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'download'
        ]
    });

    // initialize playlist and controls
    var index = 0,
    playing = false,
    mediaPath = './',
    extension = '.mp3',
    tracks = [{
        "name": "name",
        "duration": "3:31",
        "file": "1"
    },{
        "name": "name",
        "duration": "3:43",
        "file": "2"
    },{
        "name": "name",
        "duration": "3:35",
        "file": "3"
    },{
        "name": "name",
        "duration": "2:46",
        "file": "4"
    },{
        "name": "name",
        "duration": "1:33",
        "file": "5"
    }],
    x = tracks.forEach((value, i) => {
        var trackName = value.name,
            trackDuration = value.duration;

        $('#plList').append('<li> \
            <div class="plItem"> \
                <span class="plNum">' + (i + 1) + '.</span> \
                <span class="plTitle">' + trackName + '</span> \
                <span class="plLength">' + trackDuration + '</span> \
            </div> \
        </li>');
    }),
    trackCount = tracks.length,
    npAction = $('#npAction'),
    npTitle = $('#npTitle'),
    audio = $('#audio1').on('play', function () {
        playing = true;
        npAction.text('Now Playing...');
    }).on('pause', function () {
        playing = false;
        npAction.text('Paused...');
    }).on('ended', function () {
        npAction.text('Paused...');
        if ((index + 1) < trackCount) {
            index++;
            loadTrack(index);
            audio.play();
        } else {
            audio.pause();
            index = 0;
            loadTrack(index);
        }
    }).get(0),
    btnPrev = $('#btnPrev').on('click', function () {
        if ((index - 1) > -1) {
            index--;
            loadTrack(index);
            if (playing) {
                audio.play();
            }
        } else {
            audio.pause();
            index = 0;
            loadTrack(index);
        }
    }),
    btnNext = $('#btnNext').on('click', function () {
        if ((index + 1) < trackCount) {
            index++;
            loadTrack(index);
            if (playing) {
                audio.play();
            }
        } else {
            audio.pause();
            index = 0;
            loadTrack(index);
        }
    }),
    li = $('#plList li').on('click', function () {
        var id = parseInt($(this).index());
        if (id !== index) {
            playTrack(id);
        }
    }),
    loadTrack = function (id) {
        $('.plSel').removeClass('plSel');
        $('#plList li:eq(' + id + ')').addClass('plSel');
        npTitle.text(tracks[id].name);
        index = id;
        audio.src = tracks[id].file + extension;
        updateDownload(id, audio.src);
    },
    updateDownload = function (id, source) {
        player.on('loadedmetadata', function () {
            $('a[data-plyr="download"]').attr('href', source);
        });
    },
    playTrack = function (id) {
        loadTrack(id);
        audio.play();
    };

    loadTrack(index);
});
