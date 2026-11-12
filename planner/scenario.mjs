export const scenario={
 weeks:8,baseRate:28,otPremium:1.5,
 departments:[
 {id:'Receiving',headcount:17,hours:40,productiveShare:.78,absence:.09,attrition:.012,uph:90,otLimit:8,leadWeeks:3,volume:[55000,57500,60000,62000,65000,67000,69000,71000]},
 {id:'Picking',headcount:25,hours:40,productiveShare:.82,absence:.07,attrition:.008,uph:105,otLimit:8,leadWeeks:4,volume:[63000,64000,65000,66000,67000,68000,69000,70000]},
 {id:'Shipping',headcount:13,hours:40,productiveShare:.76,absence:.1,attrition:.014,uph:85,otLimit:8,leadWeeks:3,volume:[42000,45000,46000,47000,49000,51000,52000,54000]}
 ],
 transfers:[{from:'Picking',to:'Receiving',maxPaidHours:80,efficiency:.85},{from:'Picking',to:'Shipping',maxPaidHours:40,efficiency:.8}]
};