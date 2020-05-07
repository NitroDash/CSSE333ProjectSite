function redirect(addr) {
    location.href = addr;
}

var view1 = document.getElementById("view1");
var view2 = document.getElementById("view2");
var search = document.getElementById("srch");
view1.onclick = function viewPiece() {
    location.href = "piece.html"
}
view2.onclick = function viewPiece() {
    location.href = "piece.html"
}