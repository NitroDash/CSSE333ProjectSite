function createPiece(title, composer, timeUploaded, tags, stars, copyright) {
    var list = document.getElementById("list");
    var piece = document.getElementById("piece-name");
    piece.innerText = title;
    var args = [composer, timeUploaded, tags, stars, copyright];
    for (var i = 0; i < 5; i++){
        var text = `<span>${args[i]}</span>`;
        $(`#list li:nth-child(${i + 1})`).append(text)
    }
}

createPiece("Friends", "Anne Marie & Marshmello", new Date().getTime(), "Pop", "4", "N/A");