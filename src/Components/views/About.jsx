import React, { useState, useEffect } from "react";

function About() {
  return (
    <>
      <div>About</div>
      <div>fixed container</div>
      <div>
        <div className="letter">Sticky position A</div>
        <div className="number">1</div>
        <div className="number">2</div>
        <div className="number">3</div>
        <div className="number">4</div>
      </div>
      <div>
        <div className="letter">Sticky position B</div>
        <div className="number">1</div>
        <div className="number">2</div>
        <div className="number">3</div>
        <div className="number">4</div>
      </div>
      <div>
        <div className="letter">Sticky position C</div>
        <div className="number">1</div>
        <div className="number">2</div>
        <div className="number">3</div>
        <div className="number">4</div>
      </div>

      <div className="flexbox-container">
        <div className="flexbox-item">con flex-wrap: wrap</div>
        <div className="flexbox-item flexbox-item1 "> flexbox1</div>
        <div className="flexbox-item flexbox-item2"> flexbox2</div>
        <div className="flexbox-item flexbox-item3">flexbox3</div>
      </div>
      <div className="flexbox-container2">
        <div className="flexbox-item flexbox-item4 ">
          {" "}
          flexbox4 tiene un flex-shrink: 0
        </div>
        <div className="flexbox-item flexbox-item5">
          {" "}
          flexbox5 flex-shrink:2
        </div>
        <div className="flexbox-item flexbox-item6">
          flexbox6 tiene un flex-grow: 1
        </div>
      </div>
      <div className="flexbox-container3">
        <div className="flexbox-item flexbox-item7 "> flexbox 7</div>
        <div className="flexbox-item flexbox-item8"> flexbox 8 </div>
        <div className="flexbox-item flexbox-item9">flexbox 9 </div>
      </div>
{/* ====================        parallax effect ===================*/}
      <div className="wrapper">
        <header>
          <img src="/public/alusur.jpeg" alt="alusur" className="background" />
          <img src="/public/equalFront.jpeg" alt="equal" className="foreground" />
          <h2>Welcome!</h2>
          <section>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Delectus
            dolorum, vel totam eos quibusdam nulla architecto fugit unde
            voluptates quam nesciunt aperiam aspernatur aliquid quis, sequi
            ipsum numquam voluptas ullam?
          </p>
          </section>
        </header>
      </div>
    </>
  );
}

export default About;
